export const STATUSES = [
  "draft",
  "awaiting_payment",
  "payment_pending",
  "paid",
  "approved",
  "waitlisted",
  "declined",
  "refunded",
  "expired",
] as const;

export type SubmissionStatus = (typeof STATUSES)[number];

export const PAYMENT_PROVIDERS = [
  "cashapp_manual",
  "stripe_checkout",
  "square_cashapp",
] as const;

export type PaymentProviderId = (typeof PAYMENT_PROVIDERS)[number];

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: "Draft",
  awaiting_payment: "Awaiting payment",
  payment_pending: "Payment pending",
  paid: "Paid",
  approved: "Approved",
  waitlisted: "Waitlist",
  declined: "Declined",
  refunded: "Refunded",
  expired: "Expired",
};

export type FileKind = "photo" | "song1" | "song2";

export type Settings = {
  eventName: string;
  eventTagline: string;
  eventSubheading: string;
  eventDescription: string;
  presenterName: string;
  featuredArtist: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress: string;
  city: string;
  feeCents: number;
  applicationsOpen: boolean;
  submissionDeadline: string;
  cashappCashtag: string;
  cashappQrKey: string;
  artworkKey: string;
  paymentProvider: PaymentProviderId;
  contactEmail: string;
  contactPhone: string;
  instagramUrl: string;
  genreOptions: string[];
  emailFromName: string;
  emailReplyTo: string;
  termsText: string;
  privacyText: string;
  refundText: string;
  legalIsDraft: boolean;
  pendingEmailSubject: string;
  pendingEmailBody: string;
  confirmationEmailSubject: string;
  confirmationEmailBody: string;
  approvedEmailSubject: string;
  approvedEmailBody: string;
  waitlistEmailSubject: string;
  waitlistEmailBody: string;
  declinedEmailSubject: string;
  declinedEmailBody: string;
  updatedAt: string;
};

export type PublicSettings = {
  eventName: string;
  eventTagline: string;
  eventSubheading: string;
  eventDescription: string;
  featuredArtist: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress: string;
  city: string;
  feeCents: number;
  applicationsOpen: boolean;
  submissionDeadline: string;
  cashappCashtag: string;
  cashappQrReady: boolean;
  artworkUrl: string;
  artworkIsDefault: boolean;
  paymentProvider: PaymentProviderId;
  contactEmail: string;
  contactPhone: string;
  instagramUrl: string;
  genreOptions: string[];
  legalIsDraft: boolean;
  macOnline: boolean;
};

export type Submission = {
  id: string;
  publicId: string;
  resumeHash: string;
  status: SubmissionStatus;
  artistName: string;
  legalName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  instagram: string;
  genre: string;
  bio: string;
  organizerNote: string;
  song1Title: string;
  song2Title: string;
  photoKey: string;
  photoName: string;
  photoBytes: number;
  song1Key: string;
  song1Name: string;
  song1Bytes: number;
  song2Key: string;
  song2Name: string;
  song2Bytes: number;
  ackTerms: boolean;
  ackPrivacy: boolean;
  ackRefund: boolean;
  ackRights: boolean;
  ackPhoto: boolean;
  ackFee: boolean;
  ackedAt: string;
  paymentProvider: string;
  payerName: string;
  payerCashtag: string;
  paymentNote: string;
  paymentClaimedAt: string;
  paidAt: string;
  paidBy: string;
  paidAmountCents: number;
  paymentReference: string;
  providerSessionId: string;
  refundedAt: string;
  refundedBy: string;
  refundNote: string;
  decisionEmailSentAt: string;
  confirmationEmailSentAt: string;
  pendingEmailSentAt: string;
  fileHold: "disk" | "pending" | "drive" | "computer";
  driveFolderId: string;
  photoDriveId: string;
  song1DriveId: string;
  song2DriveId: string;
  infoDriveId: string;
  photoSha256: string;
  song1Sha256: string;
  song2Sha256: string;
  infoSha256: string;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type StatusEvent = {
  id: string;
  submissionId: string;
  fromStatus: string;
  toStatus: string;
  actor: string;
  note: string;
  createdAt: string;
};

export type SubmissionNote = {
  id: string;
  submissionId: string;
  body: string;
  createdAt: string;
};

export type EmailTemplateName =
  | "pending"
  | "confirmation"
  | "approved"
  | "waitlist"
  | "declined";
