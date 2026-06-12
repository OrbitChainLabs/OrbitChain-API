/** Tracks a milestone status change event */
export class MilestoneStatusHistoryDto {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: Date;
}

/** Response DTO for a campaign milestone */
export class MilestoneResponseDto {
  id: string;
  title: string;
  description: string | null;
  targetAmount: string;
  status: string;
  dueDate: Date | null;
  completedAt: Date | null;
  txHash: string | null;
  statusHistory: MilestoneStatusHistoryDto[];
}
