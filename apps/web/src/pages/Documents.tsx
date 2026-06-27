import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useMyRoles } from "@/lib/use-my-roles";
import { toast } from "sonner";

const ACCEPTED = ".pdf,.docx,.doc,.txt,.csv,.md,.json";

type Doc = { id: string; name: string; file_type: string; created_at: string };

export function Documents() {
  const { isAdmin, isSuperAdmin } = useMyRoles();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try { setDocs(await api.documents.list()); } catch {}
  };

  useEffect(() => { load(); }, []);

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No tenés permiso para acceder a esta función.
      </div>
    );
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        await api.documents.upload(file);
        ok++;
      } catch (e: any) {
        toast.error(`${file.name}: ${e.message ?? "Falló la subida"}`);
      }
    }
    if (ok) toast.success(`${ok} documento${ok > 1 ? "s" : ""} subido${ok > 1 ? "s" : ""}`);
    setUploading(false);
    load();
  };

  const handleDelete = async (doc: Doc) => {
    try {
      await api.documents.delete(doc.id);
      setDocs(d => d.filter(x => x.id !== doc.id));
      toast.success("Documento eliminado");
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo eliminar");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Base de conocimiento</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Subí documentos para que el asistente IA pueda responder preguntas sobre ellos.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
      >
        {uploading ? (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="font-medium">Soltá archivos acá o hacé clic para subir</p>
            <p className="text-muted-foreground text-xs mt-1">PDF, DOCX, TXT, CSV, MD, JSON — máx. 20 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* Document list */}
      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.file_type.toUpperCase()} · {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(doc)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {docs.length === 0 && !uploading && (
        <p className="text-center text-muted-foreground text-sm">Todavía no subiste documentos.</p>
      )}
    </div>
  );
}
