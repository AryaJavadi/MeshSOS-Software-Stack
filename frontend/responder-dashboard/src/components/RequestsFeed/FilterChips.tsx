export type FeedTab = 'recent' | 'medical' | 'other'

interface Props {
  active: FeedTab
  onChange: (t: FeedTab) => void
  counts: Record<FeedTab, number>
}

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'recent', label: 'Recent' },
  { id: 'medical', label: 'Medical' },
  { id: 'other', label: 'Other' },
]

export default function FeedTabs({ active, onChange, counts }: Props) {
  return (
    <div className="flex border-b border-border flex-shrink-0">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold border-b-2 transition-colors ${
            active === tab.id
              ? 'text-text border-accent'
              : 'text-text-muted border-transparent hover:text-text-dim hover:border-border'
          }`}
        >
          {tab.label}
          {counts[tab.id] > 0 && (
            <span
              className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full ${
                active === tab.id
                  ? 'bg-[rgba(167,139,250,0.15)] text-accent'
                  : 'bg-surface2 text-text-muted'
              }`}
            >
              {counts[tab.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
