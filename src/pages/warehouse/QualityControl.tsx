import { useState } from "react";
import { PageHeader, EmptyState } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Package,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const qcItems = [
  {
    id: "ITM-4003",
    orderId: "EW-2024-01282",
    type: "Mattress",
    customer: "Mary Njeri",
    elapsed: "6h 45m",
  },
  {
    id: "ITM-4014",
    orderId: "EW-2024-01285",
    type: "Carpet (Small)",
    customer: "Lucy Wairimu",
    elapsed: "5h 45m",
  },
];

const checklistItems = [
  { id: "stains", label: "All stains removed or treated" },
  { id: "odor", label: "No residual odors" },
  { id: "color", label: "Colors intact, no fading or bleeding" },
  { id: "texture", label: "Fabric texture restored" },
  { id: "edges", label: "Edges and seams intact" },
  { id: "dryness", label: "Completely dry to the touch" },
  { id: "packaging", label: "Ready for proper packaging" },
];

/**
 * Warehouse Quality Control Page
 * QC checklist for items that completed washing and drying.
 */
const QualityControl = () => {
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<string | null>(
    qcItems.length > 0 ? qcItems[0].id : null
  );
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");

  const currentItem = qcItems.find((item) => item.id === selectedItem);

  const toggleCheck = (checkId: string) => {
    setChecklist((prev) => ({ ...prev, [checkId]: !prev[checkId] }));
  };

  const allChecked = checklistItems.every((item) => checklist[item.id]);

  const handleApprove = () => {
    if (!allChecked) {
      toast({
        title: "Incomplete checklist",
        description: "Please complete all checklist items before approving",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Item approved!",
      description: `${currentItem?.id} passed quality control and is ready for dispatch`,
    });
    setChecklist({});
    setNotes("");
  };

  const handleReject = () => {
    toast({
      title: "Item flagged for re-processing",
      description: `${currentItem?.id} will be sent back for cleaning`,
      variant: "destructive",
    });
    setChecklist({});
    setNotes("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quality Control"
        description="Inspect cleaned items before dispatch"
      />

      {qcItems.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No items pending QC"
          description="All items have been inspected. Check back later."
        />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Item Queue */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                QC Queue ({qcItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {qcItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedItem(item.id);
                    setChecklist({});
                    setNotes("");
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedItem === item.id
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-primary/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {item.id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.type} | {item.orderId}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.elapsed}
                    </span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* QC Checklist */}
          <div className="lg:col-span-2">
            {currentItem ? (
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold">
                        Inspecting: {currentItem.id}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {currentItem.type} | Order: {currentItem.orderId} |
                        Customer: {currentItem.customer}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Checklist */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                      Inspection Checklist
                    </h4>
                    {checklistItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50"
                      >
                        <Checkbox
                          id={item.id}
                          checked={!!checklist[item.id]}
                          onCheckedChange={() => toggleCheck(item.id)}
                        />
                        <Label
                          htmlFor={item.id}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {item.label}
                        </Label>
                        {checklist[item.id] ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Inspector Notes */}
                  <div className="space-y-2">
                    <Label>Inspector Notes</Label>
                    <Textarea
                      placeholder="Any observations, issues, or special notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Progress indicator */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {Object.values(checklist).filter(Boolean).length} of{" "}
                      {checklistItems.length} checks completed
                    </span>
                    <div className="flex-1 bg-secondary rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{
                          width: `${
                            (Object.values(checklist).filter(Boolean).length /
                              checklistItems.length) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button onClick={handleApprove} disabled={!allChecked} className="flex-1">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Approve & Move to Dispatch
                    </Button>
                    <Button variant="destructive" onClick={handleReject} className="flex-1">
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject & Re-process
                    </Button>
                  </div>

                  {!allChecked && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                      <AlertTriangle className="w-4 h-4" />
                      Complete all checklist items to approve this item
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                icon={Sparkles}
                title="Select an item"
                description="Choose an item from the queue to begin inspection"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityControl;
