import { Link } from "react-router-dom";

export function NavButtons({ back, next, nextLabel, nextDisabled }: {
  back?: string;
  next?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="nav-buttons">
      {back ? (
        <Link to={`/onboarding/${back}`}>
          <button className="secondary">← Back</button>
        </Link>
      ) : <span />}
      {next ? (
        <Link to={`/onboarding/${next}`}>
          <button disabled={nextDisabled}>{nextLabel ?? "Next →"}</button>
        </Link>
      ) : <span />}
    </div>
  );
}
