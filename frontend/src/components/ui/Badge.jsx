// Status badge. Accepts backend invoice statuses (DRAFT, SENT, PAID, OVERDUE),
// case-insensitively.
export default function Badge({ status }) {
  const key = String(status || '').toUpperCase();

  const styles = {
    DRAFT:
      'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300 ring-gray-200 dark:ring-slate-700',
    SENT:
      'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 ring-blue-200 dark:ring-blue-800',
    PAID:
      'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 ring-green-200 dark:ring-green-800',
    OVERDUE:
      'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 ring-red-200 dark:ring-red-800',
  };

  const labels = {
    DRAFT: 'Draft',
    SENT: 'Sent',
    PAID: 'Paid',
    OVERDUE: 'Overdue',
  };

  const style = styles[key] || styles.DRAFT;
  const label = labels[key] || key || 'Unknown';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {label}
    </span>
  );
}
