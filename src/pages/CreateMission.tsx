import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Cpu,
  Plus,
  Rocket,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api, formatINR, SourcingRequirement } from '../api/client';

interface CreateMissionProps {
  theme: 'light' | 'dark';
}

const PRESET_TEMPLATES = [
  {
    label: 'Spiral Binded Notebooks (1,000 units, Bengaluru, ≤₹250)',
    prompt:
      'I want to manufacture 1,000 Spiral Binded Notebooks in Bengaluru under ₹250 per unit within 30 days.',
    mission_name: 'Spiral Binded Notebooks Batch #1',
    product_name: 'Spiral Binded Notebooks (A4, 160 Pages)',
    product_description:
      'A4 spiral bound notebooks with 70 GSM maplitho inner pages, 300 GSM printed duplex board cover, and nylon-coated metal wiro binding.',
    product_category: 'Stationery & Paper Products',
    quantity: 1000,
    target_unit_cost: 250,
    maximum_budget: 250000,
    material: '70 GSM Maplitho Paper, 300 GSM Duplex Board, Spiral Binding Wire',
    quality_requirements: 'High-opacity 70 GSM ruled sheets, smudge-free offset cover print',
    packaging_requirements: 'Shrink-wrapped packs of 10 in 5-Ply Corrugated Master Cartons',
    certification_requirements: 'ISO 9001:2015, FSC Paper Optional',
    preferred_sourcing_location: 'Bengaluru, Karnataka',
    delivery_deadline: 30,
    additional_requirements:
      'Custom 4-color offset brand cover printing included.',
  },
  {
    label: 'Insulated SS 304 Water Bottles (1,000 units, Bengaluru, ≤₹250)',
    prompt:
      'I want to manufacture 1,000 insulated stainless-steel water bottles in Bengaluru under ₹250 per unit within 30 days.',
    mission_name: 'Insulated SS 304 Water Bottle Batch #1',
    product_name: 'Insulated Stainless-Steel Water Bottle (750ml)',
    product_description:
      'Double-wall vacuum-insulated food-grade SS 304 water bottle with leak-proof cap and food-grade silicone sealing ring.',
    product_category: 'Reusable Drinkware',
    quantity: 1000,
    target_unit_cost: 250,
    maximum_budget: 250000,
    material: 'SS 304 Food-Grade Stainless Steel, Food-Grade Silicone',
    quality_requirements: 'Vacuum thermal retention test, BIS IS 14756 food-grade',
    packaging_requirements: 'Custom Recycled Kraft Cylinder Box & Master Cartons',
    certification_requirements: 'ISO 9001, BIS IS 14756, FSSAI Food Contact',
    preferred_sourcing_location: 'Bengaluru, Karnataka',
    delivery_deadline: 30,
    additional_requirements:
      'Custom laser-engraved brand mark on bottle body.',
  },
  {
    label: 'Bamboo Lunch Box (500 units, Bengaluru)',
    prompt:
      'I want to manufacture 500 eco-friendly bamboo fiber lunch boxes with silicone straps in Bengaluru under ₹150 per unit within 14 days.',
    mission_name: 'Bamboo Lunch Box Production',
    product_name: 'Eco-Friendly Bamboo Fiber Lunch Box with Silicone Strap',
    product_description:
      'Leak-proof 1100ml bento-style bamboo fiber lunch box with food-grade silicone seal and elastic strap.',
    product_category: 'Kitchen & Dining',
    quantity: 500,
    target_unit_cost: 150,
    maximum_budget: 75000,
    material: 'Natural Bamboo Fiber & Food-Grade Silicone',
    quality_requirements: 'BPA-free, dishwasher safe, smooth molded edges',
    packaging_requirements: 'Recycled Kraft Box with Soy Ink Print',
    certification_requirements: 'Food-grade certification (FSSAI / ISO 22000)',
    preferred_sourcing_location: 'Bengaluru, Karnataka',
    delivery_deadline: 14,
    additional_requirements:
      'Custom laser-engraved logo on bamboo lid; individual kraft sleeve.',
  },
  {
    label: 'GOTS Organic Cotton Tote Bag (1,000 units, Tiruppur)',
    prompt:
      'I want to manufacture 1,000 GOTS organic cotton 320 GSM canvas tote bags in Tiruppur under ₹85 per unit within 14 days.',
    mission_name: 'Organic Canvas Retail Tote Sourcing',
    product_name: '320 GSM GOTS Organic Cotton Gusseted Tote Bag',
    product_description:
      'Heavy-duty unbleached 320 GSM organic cotton canvas tote with reinforced cross-stitched handles and internal zip pocket.',
    product_category: 'Apparel & Bags',
    quantity: 1000,
    target_unit_cost: 85,
    maximum_budget: 90000,
    material: '320 GSM GOTS Certified Organic Cotton Canvas',
    quality_requirements: 'AZO-free water-based screen print, reinforced seams',
    packaging_requirements: 'Compostable Cornstarch Polybag',
    certification_requirements: 'GOTS Certified, OEKO-TEX Standard 100',
    preferred_sourcing_location: 'Tiruppur, Tamil Nadu',
    delivery_deadline: 14,
    additional_requirements: '2-color front graphic print included.',
  },
];

export const CreateMission: React.FC<CreateMissionProps> = ({ theme }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isLight = theme === 'light';

  const [naturalPrompt, setNaturalPrompt] = useState('');

  const [form, setForm] = useState({
    mission_name: '',
    product_name: '',
    product_description: '',
    product_category: 'Manufactured Goods',
    quantity: 1000,
    target_unit_cost: 250,
    maximum_budget: 250000,
    material: '',
    quality_requirements: '',
    packaging_requirements: 'Corrugated Master Cartons',
    certification_requirements: 'ISO 9001:2015',
    preferred_sourcing_location: 'Bengaluru, Karnataka',
    delivery_deadline: 30,
    additional_requirements: '',
  });

  const [requirements, setRequirements] = useState<SourcingRequirement[]>([]);
  const [analyzedForProduct, setAnalyzedForProduct] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const presetName = searchParams.get('mission_name');
    if (presetName) {
      setForm((prev) => ({
        ...prev,
        mission_name: presetName,
        product_name: searchParams.get('product_name') || presetName,
        product_category:
          searchParams.get('product_category') || prev.product_category,
        material: searchParams.get('material') || prev.material,
        quantity: Number(searchParams.get('quantity') || prev.quantity),
        target_unit_cost: Number(
          searchParams.get('target_unit_cost') || prev.target_unit_cost,
        ),
        maximum_budget: Number(
          searchParams.get('maximum_budget') || prev.maximum_budget,
        ),
        certification_requirements:
          searchParams.get('certification_requirements') ||
          prev.certification_requirements,
        packaging_requirements:
          searchParams.get('packaging_requirements') ||
          prev.packaging_requirements,
        preferred_sourcing_location:
          searchParams.get('preferred_sourcing_location') ||
          prev.preferred_sourcing_location,
        delivery_deadline: Number(
          searchParams.get('delivery_deadline') || prev.delivery_deadline,
        ),
      }));
    }
  }, [searchParams]);

  const handleAnalyzeProduct = async (overridePayload?: Record<string, any>) => {
    setAnalyzing(true);
    setError(null);
    try {
      const source = overridePayload || {
        prompt: naturalPrompt,
        prefer_prompt: Boolean(naturalPrompt.trim()),
        ...form,
      };
      const res = await api.analyzeProduct(source);
      const ec = res.extracted_constraints || {};
      const nextProdName = ec.product_name || form.product_name;
      setForm((prev) => ({
        ...prev,
        mission_name:
          overridePayload?.mission_name ||
          (ec.product_name ? `${ec.product_name} Sourcing` : prev.mission_name),
        product_name: nextProdName,
        product_description:
          ec.product_description || prev.product_description || naturalPrompt,
        product_category: ec.product_category || prev.product_category,
        quantity: Number(ec.quantity || prev.quantity),
        target_unit_cost: Number(ec.target_unit_cost || prev.target_unit_cost),
        maximum_budget: Number(ec.maximum_budget || prev.maximum_budget),
        delivery_deadline: Number(
          ec.delivery_deadline || prev.delivery_deadline,
        ),
        preferred_sourcing_location:
          ec.preferred_sourcing_location || prev.preferred_sourcing_location,
        material: ec.material || prev.material,
        packaging_requirements:
          ec.packaging_requirements || prev.packaging_requirements,
        certification_requirements:
          ec.certification_requirements || prev.certification_requirements,
      }));
      setRequirements(res.requirements || []);
      setAnalyzedForProduct(nextProdName.trim().toLowerCase());
    } catch (err: any) {
      setError(err.message || 'Failed to decompose product requirements.');
    } finally {
      setAnalyzing(false);
    }
  };

  const applyTemplate = async (tpl: (typeof PRESET_TEMPLATES)[0]) => {
    setNaturalPrompt(tpl.prompt);
    const nextForm = {
      mission_name: tpl.mission_name,
      product_name: tpl.product_name,
      product_description: tpl.product_description,
      product_category: tpl.product_category,
      quantity: tpl.quantity,
      target_unit_cost: tpl.target_unit_cost,
      maximum_budget: tpl.maximum_budget,
      material: tpl.material,
      quality_requirements: tpl.quality_requirements,
      packaging_requirements: tpl.packaging_requirements,
      certification_requirements: tpl.certification_requirements,
      preferred_sourcing_location: tpl.preferred_sourcing_location,
      delivery_deadline: tpl.delivery_deadline,
      additional_requirements: tpl.additional_requirements,
    };
    setForm(nextForm);
    await handleAnalyzeProduct({ prompt: tpl.prompt, ...nextForm });
  };

  const updateRequirementField = (
    idx: number,
    field: keyof SourcingRequirement,
    value: any,
  ) => {
    setRequirements((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  };

  const addRequirementRow = () => {
    setRequirements((prev) => [
      ...prev,
      {
        name: '',
        type: 'component',
        purpose: '',
        search_terms: [
          `${form.product_name || 'component'} supplier ${
            form.preferred_sourcing_location.split(',')[0]
          } India`,
        ],
        location: form.preferred_sourcing_location || 'Bengaluru, India',
        confidence: 0.9,
      },
    ]);
  };

  const removeRequirementRow = (idx: number) => {
    setRequirements((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (launchImmediately: boolean) => {
    if (!form.mission_name.trim() || !form.product_name.trim()) {
      setError('Mission Name and Product Name are required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const currentProdKey = form.product_name.trim().toLowerCase();
      const useExistingReqs =
        requirements.length > 0 &&
        (!analyzedForProduct || analyzedForProduct === currentProdKey);

      const res = await api.createMission({
        ...form,
        requirements: useExistingReqs
          ? requirements.filter((r) => r.name.trim().length > 0)
          : [],
        launch_immediately: launchImmediately,
      });
      navigate(`/missions/${res.mission.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create sourcing mission.');
    } finally {
      setLoading(false);
    }
  };

  const impliedUnitTotal = form.quantity * form.target_unit_cost;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
          AI Product Decomposition & Live Web Sourcing
        </span>
        <h1 className="text-2xl font-bold tracking-tight">
          Create New Sourcing Mission
        </h1>
        <p
          className={`mt-1 text-xs ${
            isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
          }`}
        >
          Step 1: Describe your product for AI Material/Component Decomposition. Step 2: Review & edit decomposed requirements and search queries. Step 3: Launch Live Internet Supplier Discovery.
        </p>
      </div>

      {/* Step 1: Natural Language Product Understanding & Templates */}
      <div
        className={`rounded-md border p-5 ${
          isLight
            ? 'border-[#E7E5E4] bg-white'
            : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#C84B31]" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">
              1. AI Product Understanding & Material / Component Decomposition
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TEMPLATES.map((tpl) => (
              <button
                key={tpl.mission_name}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className={`rounded-[4px] border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917] hover:border-[#C84B31]'
                    : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4] hover:border-[#C84B31]'
                }`}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <textarea
            rows={2}
            value={naturalPrompt}
            onChange={(e) => setNaturalPrompt(e.target.value)}
            placeholder="e.g., I want to manufacture 1,000 insulated stainless-steel water bottles in Bengaluru under ₹250 per unit within 30 days."
            className={`w-full rounded-md border px-3 py-2 text-sm ${
              isLight
                ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                : 'border-[#292524] bg-[#0C0A09]'
            }`}
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={analyzing}
              onClick={() => handleAnalyzeProduct()}
              className="inline-flex items-center gap-2 rounded-md bg-[#C84B31] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B03E26] disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {analyzing
                ? 'Decomposing Product into Materials & Components...'
                : 'Analyze Product & Decompose Materials / Components'}
            </button>
          </div>
        </div>
      </div>

      {/* Step 2: Review & Edit Decomposed Sourcing Requirements */}
      <div
        className={`rounded-md border p-5 ${
          isLight
            ? 'border-[#E7E5E4] bg-white'
            : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#C84B31]">
              2. Decomposed Material, Component, Packaging & Process Requirements ({requirements.length})
            </span>
            <p
              className={`mt-0.5 text-xs ${
                isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
              }`}
            >
              Review and edit the identified sourcing requirements and live web search terms below before launching supplier discovery.
            </p>
          </div>
          <button
            type="button"
            onClick={addRequirementRow}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold ${
              isLight
                ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917] hover:bg-[#F3EFEA]'
                : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4] hover:bg-[#292524]'
            }`}
          >
            <Plus className="h-3.5 w-3.5 text-[#C84B31]" />
            Add Requirement
          </button>
        </div>

        {requirements.length === 0 ? (
          <div
            className={`rounded-md border border-dashed p-5 text-center text-xs ${
              isLight
                ? 'border-[#E7E5E4] text-[#78716C]'
                : 'border-[#292524] text-[#A8A29E]'
            }`}
          >
            Click &ldquo;Analyze Product & Decompose Materials / Components&rdquo; above to generate structured sourcing requirements, or add requirements manually.
          </div>
        ) : (
          <div className="space-y-3">
            {requirements.map((req, idx) => (
              <div
                key={idx}
                className={`rounded-md border p-3.5 ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <label className="block font-mono text-[10px] uppercase text-[#78716C]">
                      Requirement Name
                    </label>
                    <input
                      type="text"
                      value={req.name}
                      onChange={(e) =>
                        updateRequirementField(idx, 'name', e.target.value)
                      }
                      className={`mt-1 w-full rounded border px-2.5 py-1.5 text-xs font-semibold ${
                        isLight
                          ? 'border-[#E7E5E4] bg-white'
                          : 'border-[#292524] bg-[#1C1917]'
                      }`}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-mono text-[10px] uppercase text-[#78716C]">
                      Type
                    </label>
                    <select
                      value={req.type}
                      onChange={(e) =>
                        updateRequirementField(idx, 'type', e.target.value)
                      }
                      className={`mt-1 w-full rounded border px-2 py-1.5 font-mono text-xs ${
                        isLight
                          ? 'border-[#E7E5E4] bg-white'
                          : 'border-[#292524] bg-[#1C1917]'
                      }`}
                    >
                      <option value="raw_material">raw_material</option>
                      <option value="component">component</option>
                      <option value="packaging">packaging</option>
                      <option value="process">process</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-mono text-[10px] uppercase text-[#78716C]">
                      Location
                    </label>
                    <input
                      type="text"
                      value={req.location}
                      onChange={(e) =>
                        updateRequirementField(idx, 'location', e.target.value)
                      }
                      className={`mt-1 w-full rounded border px-2.5 py-1.5 text-xs ${
                        isLight
                          ? 'border-[#E7E5E4] bg-white'
                          : 'border-[#292524] bg-[#1C1917]'
                      }`}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-mono text-[10px] uppercase text-[#78716C]">
                      Confidence
                    </label>
                    <div className="mt-2 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {Math.round((req.confidence || 0.9) * 100)}%
                    </div>
                  </div>

                  <div className="flex items-end justify-end sm:col-span-1">
                    <button
                      type="button"
                      onClick={() => removeRequirementRow(idx)}
                      className="rounded border border-red-500/30 p-1.5 text-red-500 hover:bg-red-500/10"
                      title="Remove requirement"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-[#78716C]">
                      Purpose in Product
                    </label>
                    <input
                      type="text"
                      value={req.purpose}
                      onChange={(e) =>
                        updateRequirementField(idx, 'purpose', e.target.value)
                      }
                      className={`mt-1 w-full rounded border px-2.5 py-1.5 text-xs ${
                        isLight
                          ? 'border-[#E7E5E4] bg-white'
                          : 'border-[#292524] bg-[#1C1917]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase text-[#78716C]">
                      Live Internet Search Queries (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={(req.search_terms || []).join(', ')}
                      onChange={(e) =>
                        updateRequirementField(
                          idx,
                          'search_terms',
                          e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        )
                      }
                      className={`mt-1 w-full rounded border px-2.5 py-1.5 font-mono text-xs ${
                        isLight
                          ? 'border-[#E7E5E4] bg-white'
                          : 'border-[#292524] bg-[#1C1917]'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-[4px] border border-[#DC2626]/40 bg-[#DC2626]/10 p-3 text-xs text-[#DC2626]">
          {error}
        </div>
      )}

      {/* Step 3: Commercial & Technical Specification */}
      <div
        className={`rounded-md border p-6 ${
          isLight
            ? 'border-[#E7E5E4] bg-white'
            : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Mission Name *
              </label>
              <input
                type="text"
                required
                value={form.mission_name}
                onChange={(e) =>
                  setForm({ ...form, mission_name: e.target.value })
                }
                placeholder="e.g., Insulated SS 304 Water Bottle Batch #1"
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Product Category *
              </label>
              <input
                type="text"
                required
                value={form.product_category}
                onChange={(e) =>
                  setForm({ ...form, product_category: e.target.value })
                }
                placeholder="Reusable Drinkware, Kitchen & Dining, Packaging..."
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
              Product Name *
            </label>
            <input
              type="text"
              required
              value={form.product_name}
              onChange={(e) =>
                setForm({ ...form, product_name: e.target.value })
              }
              placeholder="e.g., Insulated Stainless-Steel Water Bottle (750ml)"
              className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                  : 'border-[#292524] bg-[#0C0A09]'
              }`}
            />
          </div>

          <div>
            <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
              Product Description & Technical Specs
            </label>
            <textarea
              rows={2}
              value={form.product_description}
              onChange={(e) =>
                setForm({ ...form, product_description: e.target.value })
              }
              placeholder="Dimensions, finish, food contact requirements..."
              className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                  : 'border-[#292524] bg-[#0C0A09]'
              }`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Order Quantity (Units) *
              </label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) =>
                  setForm({ ...form, quantity: Number(e.target.value) })
                }
                className={`mt-1.5 w-full rounded-md border px-3 py-2 font-mono text-sm tabular-nums ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Target Unit Cost (₹) *
              </label>
              <input
                type="number"
                min={1}
                value={form.target_unit_cost}
                onChange={(e) =>
                  setForm({
                    ...form,
                    target_unit_cost: Number(e.target.value),
                  })
                }
                className={`mt-1.5 w-full rounded-md border px-3 py-2 font-mono text-sm tabular-nums ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Maximum Total Budget (₹) *
              </label>
              <input
                type="number"
                min={1}
                value={form.maximum_budget}
                onChange={(e) =>
                  setForm({ ...form, maximum_budget: Number(e.target.value) })
                }
                className={`mt-1.5 w-full rounded-md border px-3 py-2 font-mono text-sm tabular-nums ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Delivery Deadline (Days) *
              </label>
              <input
                type="number"
                min={1}
                value={form.delivery_deadline}
                onChange={(e) =>
                  setForm({
                    ...form,
                    delivery_deadline: Number(e.target.value),
                  })
                }
                className={`mt-1.5 w-full rounded-md border px-3 py-2 font-mono text-sm tabular-nums ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>
          </div>

          <div
            className={`rounded-[4px] border p-3 font-mono text-xs ${
              isLight
                ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#57534E]'
                : 'border-[#292524] bg-[#0C0A09] text-[#A8A29E]'
            }`}
          >
            Implied Base Manufacturing Spend ({form.quantity} units ×{' '}
            {formatINR(form.target_unit_cost)}):{' '}
            <strong className="text-[#C84B31]">
              {formatINR(impliedUnitTotal)}
            </strong>{' '}
            | Hard Budget Cap: <strong>{formatINR(form.maximum_budget)}</strong>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Material Specification *
              </label>
              <input
                type="text"
                value={form.material}
                onChange={(e) => setForm({ ...form, material: e.target.value })}
                placeholder="e.g., SS 304 Food-Grade Steel, Food-Grade Silicone"
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Preferred Sourcing Location *
              </label>
              <input
                type="text"
                value={form.preferred_sourcing_location}
                onChange={(e) =>
                  setForm({
                    ...form,
                    preferred_sourcing_location: e.target.value,
                  })
                }
                placeholder="e.g., Bengaluru, Karnataka"
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Required Certifications
              </label>
              <input
                type="text"
                value={form.certification_requirements}
                onChange={(e) =>
                  setForm({
                    ...form,
                    certification_requirements: e.target.value,
                  })
                }
                placeholder="e.g., ISO 9001, BIS IS 14756, FSSAI"
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Packaging Requirements
              </label>
              <input
                type="text"
                value={form.packaging_requirements}
                onChange={(e) =>
                  setForm({ ...form, packaging_requirements: e.target.value })
                }
                placeholder="e.g., Recycled Kraft Box"
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Quality Standards
              </label>
              <input
                type="text"
                value={form.quality_requirements}
                onChange={(e) =>
                  setForm({ ...form, quality_requirements: e.target.value })
                }
                placeholder="BPA-free, drop-test compliant..."
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Additional Commercial Terms
              </label>
              <input
                type="text"
                value={form.additional_requirements}
                onChange={(e) =>
                  setForm({ ...form, additional_requirements: e.target.value })
                }
                placeholder="30% advance, 70% pre-dispatch inspection..."
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-5 border-[#E7E5E4]/60">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(false)}
              className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-xs font-semibold transition-colors ${
                isLight
                  ? 'border-[#E7E5E4] bg-white text-[#1C1917] hover:bg-[#F3EFEA]'
                  : 'border-[#292524] bg-[#1C1917] text-[#F5F5F4] hover:bg-[#292524]'
              }`}
            >
              <Save className="h-4 w-4" />
              Save as Draft
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(true)}
              className="inline-flex items-center gap-2 rounded-md bg-[#C84B31] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#B03E26] disabled:opacity-50"
            >
              <Rocket className="h-4 w-4" />
              {loading
                ? 'Searching Live Web & Launching Workflow...'
                : 'Launch Mission & Run Live Internet Supplier Discovery'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
