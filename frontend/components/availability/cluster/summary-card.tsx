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
      className={`flex min-h-[96px] items-center gap-3 rounded-xl px-4 py-3 ${style.card}`}
    >
      <div className={`shrink-0 ${style.icon}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-medium text-[#475467]">{title}</p>
        <p className={`mt-1 text-[24px] font-bold leading-none ${style.value}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
