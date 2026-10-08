import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetForm } from "../components/AssetForm";
import { CompletionForm } from "../components/CompletionForm";
import { HIGH_INTERVAL_MESSAGE, INSTALL_MESSAGE, NOTES_MESSAGE, SERIAL_MESSAGE } from "../rules";

const substations = [{ id: 1, code: "SS-A", name: "Substation A", voltage_kv: 132, region: "Kothagudem" }];

async function fillValidAsset(install = "2026-09-15", serial = "TRF-10002") {
  fireEvent.change(screen.getByLabelText("Serial number"), { target: { value: serial } });
  fireEvent.change(screen.getByLabelText("Asset name"), { target: { value: "New transformer" } });
  fireEvent.change(screen.getByLabelText("Install date"), { target: { value: install } });
  fireEvent.change(screen.getByLabelText("Maintenance interval (days)"), { target: { value: "90" } });
}

describe("AssetForm", () => {
  it("shows the brief's messages and keeps the due date read-only", async () => {
    const onSubmit = vi.fn();
    const view = render(
      <AssetForm
        substations={substations}
        existingSerials={["TRF-10001"]}
        today="2026-10-01"
        submitLabel="Save asset"
        onSubmit={onSubmit}
      />,
    );
    expect(view.container.querySelector('input[name="next_due_on"]')).toBeNull();
    expect(screen.getByText(/cannot be edited/i)).toBeTruthy();

    await fillValidAsset("2026-10-10");
    fireEvent.click(screen.getByRole("button", { name: "Save asset" }));
    expect(await screen.findByText(INSTALL_MESSAGE)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    await fillValidAsset("2026-09-15", "TRF-10001");
    fireEvent.click(screen.getByRole("button", { name: "Save asset" }));
    expect(await screen.findByText(SERIAL_MESSAGE)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Serial number"), { target: { value: "TRF-10002" } });
    fireEvent.change(screen.getByLabelText("Criticality"), { target: { value: "high" } });
    fireEvent.change(screen.getByLabelText("Maintenance interval (days)"), { target: { value: "365" } });
    fireEvent.click(screen.getByRole("button", { name: "Save asset" }));
    expect(await screen.findByText(HIGH_INTERVAL_MESSAGE)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Criticality"), { target: { value: "medium" } });
    fireEvent.change(screen.getByLabelText("Maintenance interval (days)"), { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText("Install date"), { target: { value: "2026-01-01" } });
    expect(screen.getByTestId("next-due").textContent).toBe("30-Jun-2026");
  });
});

describe("CompletionForm", () => {
  it("requires notes and explains the open 7-day corrective question", async () => {
    const onSubmit = vi.fn();
    render(<CompletionForm createdOn="2026-09-20" dueOn="2026-09-25" today="2026-10-01" onSubmit={onSubmit} />);
    expect(document.querySelector('input[name="due_on"]')).toBeNull();
    expect(screen.getByText(/still an open question/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));
    expect(await screen.findByText(NOTES_MESSAGE)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
