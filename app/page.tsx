"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, Settings2, TagX, Check, Search } from "lucide-react";

interface PhoneModel {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface ColorCode {
  id: string;
  code: string;
  name: string;
}

// inventory[modelId][categoryId][colorId] = quantity
type Inventory = Record<string, Record<string, Record<string, number>>>;

type SaveState = "idle" | "saving" | "saved";

interface StoredData {
  models: PhoneModel[];
  categories: Category[];
  colors: ColorCode[];
  inventory: Inventory;
}

const genId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const DEFAULT_CATEGORIES: Category[] = [
  "Carte Normala",
  "Carte Piele",
  "360",
  "Silicon Neagra",
  "Silicon Transparenta)",
  "Catifea",
  "Sclipici",
  "Lichid",
  "MagSafe",
  "AntiShock",
  "Modele Sticla",
  "Modele Silicon",
].map((name) => ({ id: genId(), name }));


interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}

function EditableText({ value, onSave, className, inputClassName, placeholder }: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={inputClassName}
        placeholder={placeholder}
      />
    );
  }
  return (
    <span onClick={() => { setDraft(value); setEditing(true); }} className={className} title="Click pentru a redenumi">
      {value}
    </span>
  );
}

export default function PhoneCaseInventory() {
  const [loaded, setLoaded] = useState(false);
  const [models, setModels] = useState<PhoneModel[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [colors, setColors] = useState<ColorCode[]>([]);
  const [inventory, setInventory] = useState<Inventory>({});
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [newModelName, setNewModelName] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newColorCode, setNewColorCode] = useState("");
  const [newColorName, setNewColorName] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  // Load on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/inventory");
        const data: Partial<StoredData> | null = await res.json();
        if (data) {
          setModels(data.models || []);
          setCategories(data.categories && data.categories.length ? data.categories : DEFAULT_CATEGORIES);
          setColors(data.colors || []);
          setInventory(data.inventory || {});
          if (data.models && data.models.length) setSelectedModelId(data.models[0].id);
        }
      } catch {
        // request failed — defaults stand
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Debounced save
  useEffect(() => {
    if (!loaded) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const payload: StoredData = { models, categories, colors, inventory };
        await fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1200);
      } catch {
        setSaveState("idle");
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [models, categories, colors, inventory, loaded]);

  const addModel = () => {
    const name = newModelName.trim();
    if (!name) return;
    const m: PhoneModel = { id: genId(), name };
    setModels((prev) => [...prev, m]);
    setNewModelName("");
    setSelectedModelId(m.id);
  };

  const deleteModel = (id: string) => {
    setModels((prev) => prev.filter((m) => m.id !== id));
    setInventory((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (selectedModelId === id) {
      setSelectedModelId(() => {
        const remaining = models.filter((m) => m.id !== id);
        return remaining.length ? remaining[0].id : null;
      });
    }
  };

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCategories((prev) => [...prev, { id: genId(), name }]);
    setNewCategoryName("");
  };

  const deleteCategory = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setInventory((prev) => {
      const next: Inventory = {};
      for (const [modelId, byCategory] of Object.entries(prev)) {
        const copy = { ...byCategory };
        delete copy[id];
        next[modelId] = copy;
      }
      return next;
    });
  };

  const renameCategory = (id: string, name: string) =>
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));

  const addColor = () => {
    const typedCode = newColorCode.trim();
    const typedName = newColorName.trim();
    if (!typedCode && !typedName) return;
    const code = typedCode || typedName.charAt(0).toUpperCase();
    setColors((prev) => [...prev, { id: genId(), code, name: typedName }]);
    setNewColorCode("");
    setNewColorName("");
  };

  const deleteColor = (id: string) => {
    setColors((prev) => prev.filter((c) => c.id !== id));
    setInventory((prev) => {
      const next: Inventory = {};
      for (const [modelId, byCategory] of Object.entries(prev)) {
        const nextCats: Record<string, Record<string, number>> = {};
        for (const [catId, byColor] of Object.entries(byCategory)) {
          const copy = { ...byColor };
          delete copy[id];
          nextCats[catId] = copy;
        }
        next[modelId] = nextCats;
      }
      return next;
    });
  };

  const renameColorCode = (id: string, code: string) =>
    setColors((prev) => prev.map((c) => (c.id === id ? { ...c, code } : c)));
  const renameColorName = (id: string, name: string) =>
    setColors((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));

  const getQty = useCallback(
    (modelId: string, catId: string, colorId: string): number =>
      inventory?.[modelId]?.[catId]?.[colorId] ?? 0,
    [inventory]
  );

  const setQty = (modelId: string, catId: string, colorId: string, qty: number) => {
    const value = Math.max(0, Number.isFinite(qty) ? qty : 0);
    setInventory((prev) => {
      const byModel = { ...(prev[modelId] || {}) };
      const byCat = { ...(byModel[catId] || {}) };
      byCat[colorId] = value;
      byModel[catId] = byCat;
      return { ...prev, [modelId]: byModel };
    });
  };

  const rowTotal = (modelId: string, catId: string) =>
    colors.reduce((sum, c) => sum + getQty(modelId, catId, c.id), 0);
  const colTotal = (modelId: string, colorId: string) =>
    categories.reduce((sum, cat) => sum + getQty(modelId, cat.id, colorId), 0);
  const modelGrandTotal = (modelId: string) =>
    categories.reduce((sum, cat) => sum + rowTotal(modelId, cat.id), 0);

  const filteredModels = models.filter((m) =>
    m.name.toLowerCase().includes(modelSearch.toLowerCase())
  );
  const selectedModel = models.find((m) => m.id === selectedModelId);

  const qtyColor = (v: number): string => {
    if (v === 0) return "text-slate-300";
    if (v <= 2) return "text-amber-600";
    return "text-emerald-700";
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 text-sm">
        Se încarcă...
      </div>
    );
  }

  return (
    <div className="relative flex flex-col sm:flex-row h-screen min-h-[640px] bg-slate-50 text-slate-800 font-sans rounded-lg overflow-hidden border border-slate-200">
      {/* Sidebar */}
      <div className="w-full sm:w-64 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-200 bg-white flex flex-col">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between sm:block">
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">Inventar Huse</h1>
            <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">Modele de telefon</p>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="sm:hidden flex items-center gap-1 text-xs text-slate-500 border border-slate-200 rounded-md px-2 py-1"
          >
            <Settings2 size={13} /> Categorii/culori
          </button>
        </div>

        <div className="p-3 border-b border-slate-100 flex gap-1.5">
          <input
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addModel()}
            placeholder="ex: S22"
            className="flex-1 min-w-0 text-sm px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            onClick={addModel}
            className="shrink-0 bg-teal-700 text-white rounded-md px-2 hover:bg-teal-800 transition-colors"
            title="Adaugă model"
          >
            <Plus size={16} />
          </button>
        </div>

        {models.length > 5 && (
          <div className="px-3 pt-2">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder="Caută..."
                className="w-full text-xs pl-6 pr-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        )}

        <div className="max-h-40 sm:max-h-none sm:flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredModels.length === 0 && (
            <p className="text-xs text-slate-300 text-center mt-6 px-2">
              Niciun model încă. Adaugă primul model mai sus.
            </p>
          )}
          {filteredModels.map((m) => (
            <div
              key={m.id}
              onClick={() => setSelectedModelId(m.id)}
              className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-sm ${
                selectedModelId === m.id ? "bg-teal-700 text-white" : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              <span className="truncate flex-1">{m.name}</span>
              <span className={`text-[10px] mr-1 ${selectedModelId === m.id ? "text-teal-100" : "text-slate-400"}`}>
                {modelGrandTotal(m.id)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteModel(m.id);
                }}
                className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                  selectedModelId === m.id ? "text-teal-100 hover:text-white" : "text-slate-300 hover:text-rose-500"
                }`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="hidden sm:block p-2 border-t border-slate-100">
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
          >
            <Settings2 size={13} /> Categorii &amp; culori
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 border-b border-slate-200 bg-white">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              {selectedModel ? selectedModel.name : "Selectează un model"}
            </h2>
            {selectedModel && (
              <p className="text-xs text-slate-400">Total în stoc: {modelGrandTotal(selectedModel.id)} bucăți</p>
            )}
          </div>
          <span className="text-xs text-slate-300 w-16 text-right">
            {saveState === "saving" ? "se salvează…" : saveState === "saved" ? "salvat ✓" : ""}
          </span>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-6">
          {!selectedModel ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center px-8">
              Adaugă sau selectează un model de telefon din stânga pentru a introduce inventarul.
            </div>
          ) : colors.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center px-8">
              Nu ai încă niciun cod de culoare definit. Deschide „Categorii &amp; culori" din stânga jos ca să adaugi (ex: A, M, G, V).
            </div>
          ) : (
            <table className="border-collapse text-sm min-w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wide py-2 pr-4 border-b border-slate-200">
                    Categorie
                  </th>
                  {colors.map((c) => (
                    <th
                      key={c.id}
                      className="text-xs font-medium text-slate-500 py-2 px-2 border-b border-slate-200 text-center min-w-[52px]"
                      title={c.name}
                    >
                      {c.code}
                    </th>
                  ))}
                  <th className="text-xs font-medium text-slate-500 py-2 pl-4 border-b border-slate-200 text-right">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-100/60">
                    <td className="sticky left-0 bg-slate-50 text-slate-700 py-1.5 pr-4 border-b border-slate-100 whitespace-nowrap">
                      {cat.name}
                    </td>
                    {colors.map((c) => {
                      const qty = getQty(selectedModel.id, cat.id, c.id);
                      return (
                        <td key={c.id} className="border-b border-slate-100 px-1 py-1 text-center">
                          <input
                            type="number"
                            min={0}
                            value={qty === 0 ? "" : qty}
                            placeholder="0"
                            onChange={(e) => setQty(selectedModel.id, cat.id, c.id, parseInt(e.target.value, 10))}
                            className={`w-12 text-center py-1 rounded border border-transparent hover:border-slate-200 focus:border-teal-500 focus:outline-none bg-transparent font-mono ${qtyColor(qty)}`}
                          />
                        </td>
                      );
                    })}
                    <td className="text-right pl-4 pr-1 py-1.5 border-b border-slate-100 font-mono text-slate-500">
                      {rowTotal(selectedModel.id, cat.id)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="sticky left-0 bg-slate-50 text-xs font-medium text-slate-500 uppercase pt-2 pr-4">
                    Total
                  </td>
                  {colors.map((c) => (
                    <td key={c.id} className="text-center pt-2 font-mono text-xs text-slate-500">
                      {colTotal(selectedModel.id, c.id)}
                    </td>
                  ))}
                  <td className="text-right pl-4 pr-1 pt-2 font-mono text-sm font-semibold text-slate-800">
                    {modelGrandTotal(selectedModel.id)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Settings panel */}
      {settingsOpen && (
        <div className="absolute inset-0 bg-slate-900/30 flex justify-end z-10">
          <div className="w-full sm:w-96 bg-white h-full shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Categorii &amp; culori</h3>
              <button onClick={() => setSettingsOpen(false)} className="text-slate-400 hover:text-slate-700">
                <TagX size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Categories */}
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">Categorii husă</p>
                <div className="space-y-1">
                  {categories.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50">
                      <EditableText
                        value={c.name}
                        onSave={(name) => renameCategory(c.id, name)}
                        className="text-sm text-slate-700 flex-1"
                        inputClassName="flex-1 text-sm px-1.5 py-0.5 border border-slate-200 rounded"
                      />
                      <button onClick={() => deleteCategory(c.id)} className="text-slate-300 hover:text-rose-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5 mt-2">
                  <input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCategory()}
                    placeholder="Categorie nouă"
                    className="flex-1 text-sm px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button onClick={addCategory} className="shrink-0 bg-slate-800 text-white rounded-md px-2 hover:bg-slate-900">
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Colors */}
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">Coduri culoare</p>
                <div className="space-y-1">
                  {colors.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50">
                      <EditableText
                        value={c.code}
                        onSave={(code) => renameColorCode(c.id, code)}
                        className="text-sm font-mono font-semibold text-slate-800 w-8"
                        inputClassName="w-8 text-sm font-mono px-1 py-0.5 border border-slate-200 rounded"
                      />
                      <EditableText
                        value={c.name || "—"}
                        onSave={(name) => renameColorName(c.id, name)}
                        className="text-sm text-slate-500 flex-1"
                        inputClassName="flex-1 text-sm px-1.5 py-0.5 border border-slate-200 rounded"
                        placeholder="nume culoare"
                      />
                      <button onClick={() => deleteColor(c.id)} className="text-slate-300 hover:text-rose-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {colors.length === 0 && (
                    <p className="text-xs text-slate-300">Niciun cod de culoare definit încă.</p>
                  )}
                </div>
                <div className="flex gap-1.5 mt-2">
                  <input
                    value={newColorCode}
                    onChange={(e) => setNewColorCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addColor()}
                    placeholder="Cod (ex: A)"
                    className="w-20 text-sm px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                  <input
                    value={newColorName}
                    onChange={(e) => setNewColorName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addColor()}
                    placeholder="Nume (ex: Albastru)"
                    className="flex-1 text-sm px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button onClick={addColor} className="shrink-0 bg-slate-800 text-white rounded-md px-2 hover:bg-slate-900">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-slate-100">
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-full flex items-center justify-center gap-1.5 text-sm bg-teal-700 text-white py-2 rounded-md hover:bg-teal-800"
              >
                <Check size={15} /> Gata
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}