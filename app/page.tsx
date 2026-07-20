"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus,
  Trash2,
  Settings2,
  TagX,
  Check,
  Search,
  Smartphone,
  ShieldCheck,
  Cable,
} from "lucide-react";

/* =========================================================================
   TYPES
   ========================================================================= */

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
type GridInventory = Record<string, Record<string, Record<string, number>>>;

interface GridSectionData {
  models: PhoneModel[];
  categories: Category[];
  colors: ColorCode[];
  inventory: GridInventory;
}

interface AccessoryItem {
  id: string;
  name: string;
  qty: number;
}

interface AccessorySubcategory {
  id: string;
  name: string;
  items: AccessoryItem[];
}

interface StoredData {
  huse: GridSectionData;
  folii: GridSectionData;
  accesorii: AccessorySubcategory[];
}

type Section = "huse" | "folii" | "accesorii";
type SaveState = "idle" | "saving" | "saved";

const genId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* =========================================================================
   DEFAULTS
   ========================================================================= */

const DEFAULT_HUSE_CATEGORIES: Category[] = [
  "Carte Normala",
  "Carte Piele",
  "360",
  "Silicon Neagra",
  "Silicon Transparenta",
  "Catifea",
  "Sclipici",
  "Lichid",
  "MagSafe",
  "AntiShock",
  "Modele Sticla",
  "Modele Silicon",
].map((name) => ({ id: genId(), name }));

const DEFAULT_FOLII_CATEGORIES: Category[] = [
  "Sticla Normala",
  "Sticla Privacy",
  "Sticla Camera",
  "Hidrogel Fata",
  "Hidrogel Spate",
  "Mata",
].map((name) => ({ id: genId(), name }));

const DEFAULT_ACCESORII: AccessorySubcategory[] = [
  "Incarcatoare Adaptor/Cablu",
  "Casti Wireless",
  "Casti Cu Fir",
  "Suporturi Masina",
  "Incarcatoare Masina",
  "Incarcatoare Wireless",
  "Baterii Externe",
].map((name) => ({ id: genId(), name, items: [] }));

const emptyGrid = (categories: Category[]): GridSectionData => ({
  models: [],
  categories,
  colors: [],
  inventory: {},
});

/* =========================================================================
   SHARED: EditableText
   ========================================================================= */

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}

function EditableText({
  value,
  onSave,
  className,
  inputClassName,
  placeholder,
}: EditableTextProps) {
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
    <span
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={className}
      title="Click pentru a redenumi"
    >
      {value}
    </span>
  );
}

/* =========================================================================
   GRID SECTION (Huse / Folii) — model x categorie x cod culoare
   ========================================================================= */

interface GridSectionProps {
  data: GridSectionData;
  onChange: (data: GridSectionData) => void;
  modelPlaceholder: string;
  emptyModelsHint: string;
  emptyColorsHint: string;
}

function GridSection({
  data,
  onChange,
  modelPlaceholder,
  emptyModelsHint,
  emptyColorsHint,
}: GridSectionProps) {
  const { models, categories, colors, inventory } = data;
  const [selectedModelId, setSelectedModelId] = useState<string | null>(
    models[0]?.id ?? null
  );
  const [newModelName, setNewModelName] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newColorCode, setNewColorCode] = useState("");
  const [newColorName, setNewColorName] = useState("");

  // keep a valid selection if the model list changes underneath us
  useEffect(() => {
    if (selectedModelId && !models.some((m) => m.id === selectedModelId)) {
      setSelectedModelId(models[0]?.id ?? null);
    }
  }, [models, selectedModelId]);

  const patch = (partial: Partial<GridSectionData>) =>
    onChange({ ...data, ...partial });

  const addModel = () => {
    const name = newModelName.trim();
    if (!name) return;
    const m: PhoneModel = { id: genId(), name };
    patch({ models: [...models, m] });
    setNewModelName("");
    setSelectedModelId(m.id);
  };

  const deleteModel = (id: string) => {
    const nextInventory = { ...inventory };
    delete nextInventory[id];
    patch({ models: models.filter((m) => m.id !== id), inventory: nextInventory });
  };

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    patch({ categories: [...categories, { id: genId(), name }] });
    setNewCategoryName("");
  };

  const deleteCategory = (id: string) => {
    const nextInventory: GridInventory = {};
    for (const [modelId, byCategory] of Object.entries(inventory)) {
      const copy = { ...byCategory };
      delete copy[id];
      nextInventory[modelId] = copy;
    }
    patch({
      categories: categories.filter((c) => c.id !== id),
      inventory: nextInventory,
    });
  };

  const renameCategory = (id: string, name: string) =>
    patch({ categories: categories.map((c) => (c.id === id ? { ...c, name } : c)) });

  const addColor = () => {
    const typedCode = newColorCode.trim();
    const typedName = newColorName.trim();
    if (!typedCode && !typedName) return;
    const code = typedCode || typedName.charAt(0).toUpperCase();
    patch({ colors: [...colors, { id: genId(), code, name: typedName }] });
    setNewColorCode("");
    setNewColorName("");
  };

  const deleteColor = (id: string) => {
    const nextInventory: GridInventory = {};
    for (const [modelId, byCategory] of Object.entries(inventory)) {
      const nextCats: Record<string, Record<string, number>> = {};
      for (const [catId, byColor] of Object.entries(byCategory)) {
        const copy = { ...byColor };
        delete copy[id];
        nextCats[catId] = copy;
      }
      nextInventory[modelId] = nextCats;
    }
    patch({ colors: colors.filter((c) => c.id !== id), inventory: nextInventory });
  };

  const renameColorCode = (id: string, code: string) =>
    patch({ colors: colors.map((c) => (c.id === id ? { ...c, code } : c)) });
  const renameColorName = (id: string, name: string) =>
    patch({ colors: colors.map((c) => (c.id === id ? { ...c, name } : c)) });

  const getQty = useCallback(
    (modelId: string, catId: string, colorId: string): number =>
      inventory?.[modelId]?.[catId]?.[colorId] ?? 0,
    [inventory]
  );

  const setQty = (modelId: string, catId: string, colorId: string, qty: number) => {
    const value = Math.max(0, Number.isFinite(qty) ? qty : 0);
    const byModel = { ...(inventory[modelId] || {}) };
    const byCat = { ...(byModel[catId] || {}) };
    byCat[colorId] = value;
    byModel[catId] = byCat;
    patch({ inventory: { ...inventory, [modelId]: byModel } });
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

  return (
    <div className="relative flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
     
      {/* Sidebar */}
      <div className="w-full sm:w-64 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-200 bg-white flex flex-col">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between sm:block">
          <div>
            <p className="text-xs text-slate-400">Modele de telefon</p>
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
            placeholder={modelPlaceholder}
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
              <Search
                size={13}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300"
              />
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
              {emptyModelsHint}
            </p>
          )}
          {filteredModels.map((m) => (
            <div
              key={m.id}
              onClick={() => setSelectedModelId(m.id)}
              className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-sm ${
                selectedModelId === m.id
                  ? "bg-teal-700 text-white"
                  : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              <span className="truncate flex-1">{m.name}</span>
              <span
                className={`text-[10px] mr-1 ${
                  selectedModelId === m.id ? "text-teal-100" : "text-slate-400"
                }`}
              >
                {modelGrandTotal(m.id)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteModel(m.id);
                }}
                className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                  selectedModelId === m.id
                    ? "text-teal-100 hover:text-white"
                    : "text-slate-300 hover:text-rose-500"
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
              <p className="text-xs text-slate-400">
                Total în stoc: {modelGrandTotal(selectedModel.id)} bucăți
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-6">
          {!selectedModel ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center px-8">
              Adaugă sau selectează un model de telefon din stânga pentru a introduce
              inventarul.
            </div>
          ) : colors.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center px-8">
              {emptyColorsHint}
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
                        <td
                          key={c.id}
                          className="border-b border-slate-100 px-1 py-1 text-center"
                        >
                          <input
                            type="number"
                            min={0}
                            value={qty === 0 ? "" : qty}
                            placeholder="0"
                            onChange={(e) =>
                              setQty(
                                selectedModel.id,
                                cat.id,
                                c.id,
                                parseInt(e.target.value, 10)
                              )
                            }
                            className={`w-12 text-center py-1 rounded border border-transparent hover:border-slate-200 focus:border-teal-500 focus:outline-none bg-transparent font-mono ${qtyColor(
                              qty
                            )}`}
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
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <TagX size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Categories */}
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">
                  Categorii
                </p>
                <div className="space-y-1">
                  {categories.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50"
                    >
                      <EditableText
                        value={c.name}
                        onSave={(name) => renameCategory(c.id, name)}
                        className="text-sm text-slate-700 flex-1"
                        inputClassName="flex-1 text-sm px-1.5 py-0.5 border border-slate-200 rounded"
                      />
                      <button
                        onClick={() => deleteCategory(c.id)}
                        className="text-slate-300 hover:text-rose-500"
                      >
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
                  <button
                    onClick={addCategory}
                    className="shrink-0 bg-slate-800 text-white rounded-md px-2 hover:bg-slate-900"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Colors */}
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">
                  Coduri culoare
                </p>
                <div className="space-y-1">
                  {colors.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50"
                    >
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
                      <button
                        onClick={() => deleteColor(c.id)}
                        className="text-slate-300 hover:text-rose-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {colors.length === 0 && (
                    <p className="text-xs text-slate-300">
                      Niciun cod de culoare definit încă.
                    </p>
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
                  <button
                    onClick={addColor}
                    className="shrink-0 bg-slate-800 text-white rounded-md px-2 hover:bg-slate-900"
                  >
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

/* =========================================================================
   ACCESSORIES SECTION — subcategorie x listă produse (nume + cantitate)
   ========================================================================= */

interface AccessoriesSectionProps {
  data: AccessorySubcategory[];
  onChange: (data: AccessorySubcategory[]) => void;
}

function AccessoriesSection({ data, onChange }: AccessoriesSectionProps) {
  const [selectedSubId, setSelectedSubId] = useState<string | null>(
    data[0]?.id ?? null
  );
  const [newSubName, setNewSubName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");

  useEffect(() => {
    if (selectedSubId && !data.some((s) => s.id === selectedSubId)) {
      setSelectedSubId(data[0]?.id ?? null);
    }
  }, [data, selectedSubId]);

  const selected = data.find((s) => s.id === selectedSubId);

  const subTotal = (sub: AccessorySubcategory) =>
    sub.items.reduce((sum, it) => sum + it.qty, 0);
  const grandTotal = data.reduce((sum, s) => sum + subTotal(s), 0);

  const addSub = () => {
    const name = newSubName.trim();
    if (!name) return;
    const s: AccessorySubcategory = { id: genId(), name, items: [] };
    onChange([...data, s]);
    setNewSubName("");
    setSelectedSubId(s.id);
  };

  const renameSub = (id: string, name: string) =>
    onChange(data.map((s) => (s.id === id ? { ...s, name } : s)));

  const deleteSub = (id: string) => onChange(data.filter((s) => s.id !== id));

  const addItem = () => {
    if (!selected) return;
    const name = newItemName.trim();
    if (!name) return;
    const qty = Math.max(0, parseInt(newItemQty, 10) || 0);
    const item: AccessoryItem = { id: genId(), name, qty };
    onChange(
      data.map((s) => (s.id === selected.id ? { ...s, items: [...s.items, item] } : s))
    );
    setNewItemName("");
    setNewItemQty("");
  };

  const renameItem = (itemId: string, name: string) => {
    if (!selected) return;
    onChange(
      data.map((s) =>
        s.id === selected.id
          ? { ...s, items: s.items.map((it) => (it.id === itemId ? { ...it, name } : it)) }
          : s
      )
    );
  };

  const setItemQty = (itemId: string, qty: number) => {
    if (!selected) return;
    const value = Math.max(0, Number.isFinite(qty) ? qty : 0);
    onChange(
      data.map((s) =>
        s.id === selected.id
          ? { ...s, items: s.items.map((it) => (it.id === itemId ? { ...it, qty: value } : it)) }
          : s
      )
    );
  };

  const deleteItem = (itemId: string) => {
    if (!selected) return;
    onChange(
      data.map((s) =>
        s.id === selected.id
          ? { ...s, items: s.items.filter((it) => it.id !== itemId) }
          : s
      )
    );
  };

  const qtyColor = (v: number): string => {
    if (v === 0) return "text-slate-300";
    if (v <= 2) return "text-amber-600";
    return "text-emerald-700";
  };

  return (
    <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
      {/* Sidebar: subcategorii */}
      <div className="w-full sm:w-64 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-200 bg-white flex flex-col">
        <div className="p-3 border-b border-slate-100">
          <p className="text-xs text-slate-400">Subcategorii accesorii</p>
        </div>

        <div className="p-3 border-b border-slate-100 flex gap-1.5">
          <input
            value={newSubName}
            onChange={(e) => setNewSubName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSub()}
            placeholder="ex: Genti/Rucsacuri"
            className="flex-1 min-w-0 text-sm px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            onClick={addSub}
            className="shrink-0 bg-teal-700 text-white rounded-md px-2 hover:bg-teal-800 transition-colors"
            title="Adaugă subcategorie"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="max-h-40 sm:max-h-none sm:flex-1 overflow-y-auto p-2 space-y-0.5">
          {data.length === 0 && (
            <p className="text-xs text-slate-300 text-center mt-6 px-2">
              Niciun tip de accesoriu încă. Adaugă primul mai sus.
            </p>
          )}
          {data.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedSubId(s.id)}
              className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-sm ${
                selectedSubId === s.id
                  ? "bg-teal-700 text-white"
                  : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              <span className="truncate flex-1">{s.name}</span>
              <span
                className={`text-[10px] mr-1 ${
                  selectedSubId === s.id ? "text-teal-100" : "text-slate-400"
                }`}
              >
                {subTotal(s)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSub(s.id);
                }}
                className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                  selectedSubId === s.id
                    ? "text-teal-100 hover:text-white"
                    : "text-slate-300 hover:text-rose-500"
                }`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wide">Total general</span>
          <span className="text-sm font-mono font-semibold text-slate-700">{grandTotal}</span>
        </div>
      </div>

      {/* Main: lista de produse */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 border-b border-slate-200 bg-white">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              {selected ? selected.name : "Selectează o subcategorie"}
            </h2>
            {selected && (
              <p className="text-xs text-slate-400">Total în stoc: {subTotal(selected)} bucăți</p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-6">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center px-8">
              Adaugă sau selectează o subcategorie din stânga pentru a introduce produsele.
            </div>
          ) : (
            <>
              <table className="border-collapse text-sm w-full max-w-xl">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide py-2 pr-4 border-b border-slate-200">
                      Produs
                    </th>
                    <th className="text-xs font-medium text-slate-500 py-2 px-2 border-b border-slate-200 text-center w-20">
                      Cant.
                    </th>
                    <th className="border-b border-slate-200 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {selected.items.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-xs text-slate-300">
                        Niciun produs adăugat încă în această subcategorie.
                      </td>
                    </tr>
                  )}
                  {selected.items.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-100/60">
                      <td className="py-1.5 pr-4 border-b border-slate-100">
                        <EditableText
                          value={it.name}
                          onSave={(name) => renameItem(it.id, name)}
                          className="text-slate-700"
                          inputClassName="w-full text-sm px-1.5 py-0.5 border border-slate-200 rounded"
                        />
                      </td>
                      <td className="border-b border-slate-100 px-1 py-1 text-center">
                        <input
                          type="number"
                          min={0}
                          value={it.qty === 0 ? "" : it.qty}
                          placeholder="0"
                          onChange={(e) => setItemQty(it.id, parseInt(e.target.value, 10))}
                          className={`w-16 text-center py-1 rounded border border-transparent hover:border-slate-200 focus:border-teal-500 focus:outline-none bg-transparent font-mono ${qtyColor(
                            it.qty
                          )}`}
                        />
                      </td>
                      <td className="border-b border-slate-100 text-center">
                        <button
                          onClick={() => deleteItem(it.id)}
                          className="text-slate-300 hover:text-rose-500"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex gap-1.5 mt-3 max-w-xl">
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem()}
                  placeholder="ex: Cablu Type-C 1m"
                  className="flex-1 min-w-0 text-sm px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <input
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem()}
                  type="number"
                  min={0}
                  placeholder="cant."
                  className="w-20 text-sm px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                />
                <button
                  onClick={addItem}
                  className="shrink-0 bg-slate-800 text-white rounded-md px-2 hover:bg-slate-900"
                >
                  <Plus size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MAIN COMPONENT
   ========================================================================= */

const TABS: { id: Section; label: string; icon: typeof Smartphone }[] = [
  { id: "huse", label: "Huse", icon: Smartphone },
  { id: "folii", label: "Folii", icon: ShieldCheck },
  { id: "accesorii", label: "Accesorii", icon: Cable },
];

export default function InventoryPage() {
  const [loaded, setLoaded] = useState(false);
  const [section, setSection] = useState<Section>("huse");

  const [huse, setHuse] = useState<GridSectionData>(
    emptyGrid(DEFAULT_HUSE_CATEGORIES)
  );
  const [folii, setFolii] = useState<GridSectionData>(
    emptyGrid(DEFAULT_FOLII_CATEGORIES)
  );
  const [accesorii, setAccesorii] = useState<AccessorySubcategory[]>(
    DEFAULT_ACCESORII
  );

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  // Load on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/inventar-huse-migrat");
        const data: Partial<StoredData> | null = await res.json();
        if (data) {
          if (data.huse) setHuse(data.huse);
          if (data.folii) setFolii(data.folii);
          if (data.accesorii && data.accesorii.length) setAccesorii(data.accesorii);
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
        const payload: StoredData = { huse, folii, accesorii };
        await fetch("/api/inventar-huse-migrat", {
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
  }, [huse, folii, accesorii, loaded]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 text-sm">
        Se încarcă...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen min-h-[640px] bg-slate-50 text-slate-800 font-sans rounded-lg overflow-hidden border border-slate-200">
      {/* Top bar: tabs + save state */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-4">
        <div className="flex items-center gap-1 py-2">
          {TABS.map((t) => {
            const Icon = t.icon;  
            const active = section === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSection(t.id)}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors ${
                  active
                    ? "bg-teal-700 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-slate-300 w-16 text-right">
          {saveState === "saving" ? "se salvează…" : saveState === "saved" ? "salvat ✓" : ""}
        </span>
      </div>

      {section === "huse" && (
        <GridSection
          data={huse}
          onChange={setHuse}
          modelPlaceholder="ex: S22"
          emptyModelsHint="Niciun model încă. Adaugă primul model mai sus."
          emptyColorsHint='Nu ai încă niciun cod de culoare definit. Deschide „Categorii & culori" din stânga jos ca să adaugi (ex: A, M, G, V).'
        />
      )}
      {section === "folii" && (
        <GridSection
          data={folii}
          onChange={setFolii}
          modelPlaceholder="ex: iPhone 15"
          emptyModelsHint="Niciun model încă. Adaugă primul model mai sus."
          emptyColorsHint='Nu ai încă niciun tip de folie definit. Deschide „Categorii & culori" din stânga jos ca să adaugi.'
        />
      )}
      {section === "accesorii" && (
        <AccessoriesSection data={accesorii} onChange={setAccesorii} />
      )}
    </div>
  );
}