import { ImportWizard } from "./import-wizard";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Migrate your coworking space data from OfficeRnd.
        </p>
      </div>

      <ImportWizard />
    </div>
  );
}
