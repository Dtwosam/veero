type QuickLinkCardProps = {
  title: string;
  description: string;
  href: string;
};

export function QuickLinkCard({ title, description, href }: QuickLinkCardProps) {
  const badge = title === "Arc Faucet" ? "Top up" : title === "Arc Explorer" ? "Follow" : "Learn";
  const accentTone = title === "Arc Faucet" ? "from-coral/16 to-blush/12" : title === "Arc Explorer" ? "from-cyan/16 to-aqua/10" : "from-violet/16 to-cyan/10";

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="panel panel-hover sheen group rounded-[1.2rem] p-3.5 fade-up-soft"
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-slate-900">{title}</p>
          </div>
          <div className={`badge-pop bg-gradient-to-r ${accentTone}`}>
            {badge}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-[0.9rem] border border-white/10 bg-gradient-to-r from-violet/10 via-transparent to-cyan/10 px-3 py-2 text-sm font-medium">
          <span className="link-lift text-cyan group-hover:text-aqua">Open this</span>
          <span className="text-slate-500 transition-transform duration-200 group-hover:translate-x-1.5 group-hover:text-slate-900">
            &rarr;
          </span>
        </div>
      </div>
    </a>
  );
}
