type StatusCardProps = {
  title: string;
  value: string;
  helper?: string;
};


export function StatusCard({ title, value, helper }: StatusCardProps) {
  return (
    <div className="glass" style={{ padding: 20 }}>
      <p style={{ margin: 0, color: "#9bb4ca" }}>{title}</p>
      <h3 style={{ margin: "12px 0 8px", fontSize: 30 }}>{value}</h3>
      {helper ? <p style={{ margin: 0, color: "#7f97af" }}>{helper}</p> : null}
    </div>
  );
}
