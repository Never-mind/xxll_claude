export function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value || 0);
  return (Number.isFinite(amount) ? amount : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function quotationStatusLabel(status: string | null | undefined): string {
  const labels: Record<string, string> = {
    draft: '草稿',
    completed: '已完成',
    open: '进行中',
    active: '启用',
    inactive: '停用',
    normal: '正常合作',
    suspended: '暂停合作',
    terminated: '终止合作',
    not_cooperated: '未合作过',
  };
  return labels[status || ''] || status || '-';
}
