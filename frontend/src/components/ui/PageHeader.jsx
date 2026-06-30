export default function PageHeader({
  title,
  description,
  action,
}) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {title}
        </h1>

        {description && (
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}