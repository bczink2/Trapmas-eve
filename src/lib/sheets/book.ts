import { defaultSettings } from "@/lib/defaults";
import { getGoogleAccessToken, googleDriveClient } from "@/lib/drive/google";
import { AppError } from "@/lib/errors";
import { mainFolderName } from "@/lib/sync-lib.mjs";
import {
  EMAIL_KEYS,
  EVENT_KEYS,
  NOTE_KEYS,
  SUBMISSION_KEYS,
  WEBHOOK_KEYS,
  columnName,
  settingsPairs,
} from "@/lib/sheets/codec";

export const SHEET_TABS = ["settings", "submissions", "events", "notes", "emails", "webhooks", "meta"] as const;
export type SheetTab = (typeof SHEET_TABS)[number];

const HEADERS: Record<SheetTab, readonly string[]> = {
  settings: ["key", "value"],
  submissions: SUBMISSION_KEYS,
  events: EVENT_KEYS,
  notes: NOTE_KEYS,
  emails: EMAIL_KEYS,
  webhooks: WEBHOOK_KEYS,
  meta: ["key", "value"],
};

const SPREADSHEET_NAME = "TRAPMAS submissions";

type Grid = string[][];

function asError(status: number, detail: string): Error {
  if (status === 401 || status === 403) {
    return new AppError(
      503,
      "Google refused the spreadsheet. Reconnect the Drive account and allow both Drive and Google Sheets.",
      "not_configured",
    );
  }
  return new Error(detail.slice(0, 300) || `Google Sheets failed (${status}).`);
}

async function sheetsFetch(url: string, init: RequestInit = {}) {
  const token = await getGoogleAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  return response;
}

export class SheetBook {
  constructor(
    readonly spreadsheetId: string,
    private readonly sheetIds: Record<string, number>,
  ) {}

  static async open(): Promise<SheetBook> {
    const parent = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!parent) throw new AppError(503, "Google Drive is not configured.", "not_configured");
    const drive = googleDriveClient();
    const folderId = await eventFolderId(drive, parent);
    const spreadsheetId = await findOrCreateSpreadsheet(folderId);
    const meta = await sheetsFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`);
    const body = (await meta.json()) as {
      sheets?: { properties: { sheetId: number; title: string } }[];
      error?: { message?: string };
    };
    if (!meta.ok) throw asError(meta.status, body.error?.message || "");
    const titles = new Map((body.sheets || []).map((sheet) => [sheet.properties.title, sheet.properties.sheetId]));
    const requests: object[] = [];
    if (!titles.has("settings")) {
      const sheet1 = body.sheets?.find((sheet) => sheet.properties.title === "Sheet1");
      if (sheet1) {
        requests.push({
          updateSheetProperties: {
            properties: { sheetId: sheet1.properties.sheetId, title: "settings" },
            fields: "title",
          },
        });
        titles.set("settings", sheet1.properties.sheetId);
        titles.delete("Sheet1");
      }
    }
    for (const title of SHEET_TABS) {
      if (!titles.has(title)) {
        requests.push({ addSheet: { properties: { title } } });
      }
    }
    if (requests.length) {
      await batch(spreadsheetId, requests);
      return SheetBook.open();
    }
    const ids: Record<string, number> = {};
    for (const [title, id] of titles) ids[title] = id;
    const book = new SheetBook(spreadsheetId, ids);
    await book.ensureHeaders();
    return book;
  }

  async values(tab: SheetTab): Promise<Grid> {
    const last = columnName(HEADERS[tab].length);
    const response = await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${tab}!A1:${last}?valueRenderOption=UNFORMATTED_VALUE`,
    );
    const body = (await response.json()) as { values?: unknown[][]; error?: { message?: string } };
    if (!response.ok) throw asError(response.status, body.error?.message || "");
    return (body.values || []).map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
  }

  async writeRow(tab: SheetTab, rowNumber: number, row: string[]): Promise<void> {
    const last = columnName(Math.max(row.length, 1));
    const response = await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${tab}!A${rowNumber}:${last}${rowNumber}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] }),
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      throw asError(response.status, body.error?.message || "");
    }
  }

  async writeGrid(tab: SheetTab, rows: string[][]): Promise<void> {
    const width = Math.max(HEADERS[tab].length, ...rows.map((row) => row.length), 1);
    const last = columnName(width);
    const response = await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${tab}!A1:${last}${Math.max(rows.length, 1)}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: rows.length ? rows : [Array.from(HEADERS[tab])] }),
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      throw asError(response.status, body.error?.message || "");
    }
  }

  async append(tab: SheetTab, row: string[]): Promise<void> {
    const response = await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${tab}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] }),
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      throw asError(response.status, body.error?.message || "");
    }
  }

  async deleteDataRow(tab: SheetTab, dataIndex: number): Promise<void> {
    const sheetId = this.sheetIds[tab];
    if (sheetId == null) throw new Error(`Missing ${tab} tab.`);
    const start = dataIndex + 1;
    await batch(this.spreadsheetId, [
      {
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: start, endIndex: start + 1 },
        },
      },
    ]);
  }

  private async ensureHeaders(): Promise<void> {
    for (const tab of SHEET_TABS) {
      const grid = await this.values(tab);
      const expected = Array.from(HEADERS[tab]);
      const header = grid[0] || [];
      const same = expected.every((key, index) => header[index] === key);
      if (!same) {
        if (grid.length > 1) throw new Error(`The ${tab} tab has an unexpected header. Rename that tab and reload.`);
        await this.writeRow(tab, 1, expected);
      }
    }
    const settings = await this.values("settings");
    if (settings.length < 2) {
      await this.writeGrid("settings", [["key", "value"], ...settingsPairs(defaultSettings())]);
    }
    const meta = await this.values("meta");
    if (!meta.slice(1).some((row) => row[0] === "submission_seq")) {
      await this.append("meta", ["submission_seq", "0"]);
    }
  }
}

async function batch(spreadsheetId: string, requests: object[]) {
  const response = await sheetsFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw asError(response.status, body.error?.message || "");
  }
}

export async function eventFolderId(
  drive: ReturnType<typeof googleDriveClient> = googleDriveClient(),
  parentId = process.env.GOOGLE_DRIVE_FOLDER_ID || "",
): Promise<string> {
  if (!parentId) throw new AppError(503, "Google Drive is not configured.", "not_configured");
  const wanted = mainFolderName(defaultSettings().eventName, defaultSettings().featuredArtist);
  const listed = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${parentId}?fields=name&supportsAllDrives=true`,
  );
  const parent = (await listed.json()) as { name?: string };
  if (listed.ok && parent.name === wanted) return parentId;
  return drive.ensureFolder(parentId, wanted);
}

async function findOrCreateSpreadsheet(folderId: string): Promise<string> {
  const q = encodeURIComponent(
    `name = '${SPREADSHEET_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
  );
  const listed = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,parents)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  );
  const found = (await listed.json()) as { files?: { id: string; parents?: string[] }[] };
  const match = found.files?.find((file) => file.parents?.includes(folderId)) || found.files?.[0];
  if (match?.id) return match.id;
  const created = await driveFetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: SPREADSHEET_NAME,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId],
    }),
  });
  const sheet = (await created.json()) as { id?: string; error?: { message?: string } };
  if (!created.ok || !sheet.id) throw asError(created.status, sheet.error?.message || "Could not create the spreadsheet.");
  return sheet.id;
}

async function driveFetch(url: string, init: RequestInit = {}) {
  const token = await getGoogleAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}
