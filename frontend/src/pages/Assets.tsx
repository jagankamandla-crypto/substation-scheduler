import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import { useAuth } from "../auth";
import { formatDisplay } from "../format";
import type { Asset } from "../types";
import { Banner, PageHeader } from "../components/ui";
import { StatusPills } from "./Dashboard";

export function AssetsPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [criticality, setCriticality] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  useEffect(() => {
    api<Asset[]>("/api/assets")
      .then(setAssets)
      .catch((reason) => setError(errorMessage(reason)));
  }, []);

  const rows = useMemo(() => {
    return assets
      .filter((asset) => {
        const haystack = `${asset.serial} ${asset.name} ${asset.substation_name}`.toLowerCase();
        if (query && !haystack.includes(query.toLowerCase())) return false;
        if (criticality !== "all" && asset.criticality !== criticality) return false;
        if (overdueOnly && !asset.overdue) return false;
        return true;
      })
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.next_due_on ?? "").localeCompare(b.next_due_on ?? ""));
  }, [assets, query, criticality, overdueOnly]);

  return (
    <div className="page">
      <PageHeader
        kicker="Register"
        title="Assets"
        lede="One register for every substation. The next due date is calculated from the last maintenance date, or the install date, plus the interval."
        action={
          user?.role === "asset_manager" ? (
            <Link className="btn primary" to="/assets/new">
              New asset
            </Link>
          ) : null
        }
      />
      {error ? <Banner>{error}</Banner> : null}
      <div className="filters">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search serial, name, substation"
          aria-label="Search assets"
        />
        {["all", "high", "medium", "low"].map((value) => (
          <button
            key={value}
            type="button"
            className={criticality === value ? "chip on" : "chip"}
            onClick={() => setCriticality(value)}
          >
            {value === "all" ? "All criticality" : value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
        <button type="button" className={overdueOnly ? "chip on" : "chip"} onClick={() => setOverdueOnly((value) => !value)}>
          Overdue only
        </button>
      </div>
      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Serial</th>
              <th>Asset</th>
              <th>Substation</th>
              <th>Voltage</th>
              <th>Status</th>
              <th>Next due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((asset) => (
              <tr key={asset.id}>
                <td className="mono">
                  <Link to={`/assets/${asset.id}`}>{asset.serial}</Link>
                </td>
                <td>
                  {asset.name}
                  <div className="muted">{asset.asset_type_label}</div>
                </td>
                <td>
                  {asset.substation_name}
                  <div className="muted">{asset.substation_region}</div>
                </td>
                <td>{asset.voltage_kv} kV</td>
                <td>
                  <StatusPills
                    statusLabel={asset.status_label}
                    criticality={asset.criticality}
                    criticalityLabel={asset.criticality_label}
                    overdue={asset.overdue}
                  />
                </td>
                <td>{formatDisplay(asset.next_due_on)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && !error ? <p className="empty">No assets match these filters.</p> : null}
      </div>
    </div>
  );
}
