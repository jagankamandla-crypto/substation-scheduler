import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../api";
import { todayISO } from "../format";
import type { Asset, Substation } from "../types";
import { AssetForm, type AssetPayload } from "../components/AssetForm";
import { Banner, PageHeader } from "../components/ui";

export function AssetFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [serials, setSerials] = useState<string[]>([]);
  const [initial, setInitial] = useState<AssetPayload | undefined>();
  const [lastMaintenance, setLastMaintenance] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Substation[]>("/api/substations"), api<Asset[]>("/api/assets")])
      .then(([yards, assets]) => {
        setSubstations(yards);
        setSerials(assets.map((asset) => asset.serial));
        if (!id) return;
        const current = assets.find((asset) => String(asset.id) === id);
        if (!current) {
          setError("Asset not found.");
          return;
        }
        setLastMaintenance(current.last_maintenance_on);
        setInitial({
          serial: current.serial,
          name: current.name,
          asset_type: current.asset_type,
          substation_id: current.substation_id,
          voltage_kv: current.voltage_kv,
          criticality: current.criticality,
          interval_days: current.interval_days,
          install_date: current.install_date,
        });
      })
      .catch((reason) => setError(errorMessage(reason)));
  }, [id]);

  if (error) return <Banner>{error}</Banner>;
  if (!substations.length || (editing && !initial)) return <p className="muted">Loading the form…</p>;

  return (
    <div className="page narrow">
      <PageHeader
        kicker={editing ? "Edit asset" : "New asset"}
        title={editing ? initial?.serial ?? "Asset" : "Add an asset"}
        lede="Serial numbers are unique. Install date cannot be in the future. High-criticality assets cannot exceed a 180-day interval."
      />
      <article className="card">
        <AssetForm
          substations={substations}
          existingSerials={serials}
          today={todayISO()}
          currentSerial={initial?.serial}
          lastMaintenance={lastMaintenance}
          initial={initial}
          submitLabel={editing ? "Save changes" : "Create asset"}
          onSubmit={async (values) => {
            const saved = editing
              ? await api<Asset>(`/api/assets/${id}`, { method: "PUT", body: values })
              : await api<Asset>("/api/assets", { method: "POST", body: values });
            navigate(`/assets/${saved.id}`);
          }}
        />
      </article>
    </div>
  );
}
