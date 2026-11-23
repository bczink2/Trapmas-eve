export type DriveClient = {
  ensureFolder(parentId: string, name: string): Promise<string>;
  upload(folderId: string, name: string, mime: string, data: Buffer): Promise<{ id: string }>;
  download(fileId: string): Promise<Buffer>;
  remove(fileId: string): Promise<void>;
  move(fileId: string, toParent: string, fromParent: string, name?: string): Promise<void>;
};

export function memoryDrive(): DriveClient & { files: Map<string, { name: string; parent: string; data: Buffer; folder: boolean }> } {
  const files = new Map<string, { name: string; parent: string; data: Buffer; folder: boolean }>();
  let n = 0;
  return {
    files,
    async ensureFolder(parentId, name) {
      for (const [id, file] of files) {
        if (file.folder && file.parent === parentId && file.name === name) return id;
      }
      const id = `folder-${++n}`;
      files.set(id, { name, parent: parentId, data: Buffer.alloc(0), folder: true });
      return id;
    },
    async upload(folderId, name, _mime, data) {
      const id = `file-${++n}`;
      files.set(id, { name, parent: folderId, data: Buffer.from(data), folder: false });
      return { id };
    },
    async download(fileId) {
      const file = files.get(fileId);
      if (!file || file.folder) throw new Error("Drive file missing.");
      return Buffer.from(file.data);
    },
    async remove(fileId) {
      files.delete(fileId);
    },
    async move(fileId, toParent, fromParent, name) {
      const file = files.get(fileId);
      if (!file || file.parent !== fromParent) throw new Error("Drive file missing.");
      file.parent = toParent;
      if (name) file.name = name;
    },
  };
}
