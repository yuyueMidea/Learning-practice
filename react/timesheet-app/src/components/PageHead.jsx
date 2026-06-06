export default function PageHead({ title, desc, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {actions && <div className="head-actions">{actions}</div>}
    </div>
  );
}
