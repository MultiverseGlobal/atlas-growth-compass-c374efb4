import { FileText } from "lucide-react";

export default function Reports() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Reports</h1>
      <div className="mt-10 rounded-xl border border-dashed border-border p-10 text-center bg-card/50">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 mb-4">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <h3 className="font-display text-lg font-semibold">Reports engine coming soon</h3>
      </div>
    </div>
  );
}
