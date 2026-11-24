export function ClusterSummaryCard({
  title,
  value,
  icon,
  variant,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  variant: "total" | "available" | "reserved" | "sold";
}) {
  const variants = {
    total: {
      card: "bg-[#eef7ff]",
      icon: "text-[#248cff]",
      value: "text-[#1616a3]",
    },
    available: {
      card: "bg-[#effff1]",
      icon: "text-[#2caf46]",
      value: "text-[#111827]",
    },
    reserved: {
      card: "bg-[#fff6e6]",
      icon: "text-[#ff8f00]",
      value: "text-[#a83600]",
    },
    sold: {
      card: "bg-[#f4f4f5]",
      icon: "text-[#333333]",
      value: "text-[#111827]",
    },
  };
  const style = variants[variant];

  return (
    <div
      className={`flex min-h-20 min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-3 py-3 ${style.card}`}
    >
      <div className="flex min-w-0 max-w-full items-center gap-1.5">
        <span className={`shrink-0 ${style.icon}`}>{icon}</span>
        <p className={`truncate text-xs font-semibold ${style.icon}`} title={title}>{title}</p>
      </div>
      <p className={`text-2xl font-bold leading-none ${style.value}`}>
        {value.toLocaleString("id-ID")}
      </p>
    </div>
  );
}
