import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function DashboardCharts({ data }) {
  const statuses = ['To Do', 'In Progress', 'In Review', 'Completed'];
  const colors = ['var(--chart-5)', 'var(--chart-info)', 'var(--chart-2)', 'var(--chart-success)'];
  const counts = Object.fromEntries((data.taskStatus || []).map(status => [status._id, status.count]));
  const pie = statuses.map((name, index) => ({ name, value: counts[name] || 0, color: colors[index] }));
  const line = (data.completedByDay || []).map(day => ({ date: day._id, count: day.count }));
  return <>
    <section className="panel">
      <div className="panel-heading"><div><h2>Task status</h2><p>Current work across this workspace</p></div></div>
      <div className="dashboard-chart"><ResponsiveContainer width="52%" height={170}><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={68} paddingAngle={3}>{pie.map(status => <Cell key={status.name} fill={status.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="chart-legend">{pie.map(status => <div key={status.name}><i style={{ background: status.color }}/>{status.name}<b>{status.value}</b></div>)}</div></div>
    </section>
    <section className="panel">
      <div className="panel-heading"><div><h2>Completed over time</h2><p>Last 30 days</p></div></div>
      <ResponsiveContainer width="100%" height={170}><LineChart data={line} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--muted)' }} tickFormatter={value => value.slice(5)}/><YAxis allowDecimals={false} tick={{ fontSize: 9, fill: 'var(--muted)' }}/><Tooltip/><Line type="monotone" dataKey="count" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 2 }}/></LineChart></ResponsiveContainer>
    </section>
  </>;
}
