/** Recognizes the brief's approval/cancel phrases from typed or spoken text. */
export type ApprovalDecision = 'approved' | 'cancelled';

export function classifyApprovalPhrase(text: string): ApprovalDecision | null {
  const normalized = text.trim().toLowerCase();
  if (['yes', 'do it', 'go ahead', 'approved', 'approve'].includes(normalized)) {
    return 'approved';
  }
  if (['no', 'wait', 'hold on', 'cancel', 'stop'].includes(normalized)) {
    return 'cancelled';
  }
  return null;
}
