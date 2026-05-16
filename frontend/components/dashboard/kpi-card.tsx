type Props = {

  title: string

  value: string | number

  color?: string
}

export function KpiCard({
  title,
  value,
  color,
}: Props) {

  return (

    <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">

      <p className="text-slate-400">
        {title}
      </p>

      <h2
        className={`text-3xl font-bold mt-2 ${color}`}
      >
        {value}
      </h2>

    </div>
  )
}