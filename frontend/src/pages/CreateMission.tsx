import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Rocket, Save, Sparkles } from 'lucide-react';
import { api, formatINR } from '../api/client';

interface CreateMissionProps {
  theme: 'light' | 'dark';
}

const PRESET_TEMPLATES = [
  {
    label: 'Bamboo Lunch Box (500 units, Bengaluru)',
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
    label: 'Hammered Copper Water Bottle (300 units, Moradabad)',
    mission_name: 'Pure Copper Bottle Batch 01',
    product_name: '99.7% Pure Hammered Ayurvedic Copper Water Bottle (950ml)',
    product_description:
      'Seamless joint-free pure copper water bottle with food-grade lacquer exterior and leak-proof silicone washer cap.',
    product_category: 'Reusable Drinkware',
    quantity: 300,
    target_unit_cost: 320,
    maximum_budget: 105000,
    material: '99.7% Pure Electrolytic Grade Copper',
    quality_requirements: 'Joint-free body, lab-tested copper purity certificate',
    packaging_requirements: 'Cylindrical Recycled Kraft Tube',
    certification_requirements: 'ISO 9001, Lab Purity Test',
    preferred_sourcing_location: 'Moradabad, Uttar Pradesh',
    delivery_deadline: 15,
    additional_requirements: 'Include care instruction card inside each tube.',
  },
  {
    label: 'GOTS Organic Cotton Tote Bag (1,000 units, Tiruppur)',
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

  const [form, setForm] = useState({
    mission_name: '',
    product_name: '',
    product_description: '',
    product_category: 'Kitchen & Dining',
    quantity: 500,
    target_unit_cost: 150,
    maximum_budget: 75000,
    material: '',
    quality_requirements: '',
    packaging_requirements: 'Recycled Kraft Box',
    certification_requirements: 'Food-grade certification',
    preferred_sourcing_location: 'Bengaluru, Karnataka',
    delivery_deadline: 14,
    additional_requirements: '',
  });

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

  const applyTemplate = (tpl: (typeof PRESET_TEMPLATES)[0]) => {
    setForm({
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
    });
  };

  const handleSubmit = async (launchImmediately: boolean) => {
    if (!form.mission_name.trim() || !form.product_name.trim()) {
      setError('Mission Name and Product Name are required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.createMission({
        ...form,
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
          Mission Specification Builder
        </span>
        <h1 className="text-2xl font-bold tracking-tight">
          Create New Sourcing Mission
        </h1>
        <p
          className={`mt-1 text-xs ${
            isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
          }`}
        >
          Define hard commercial constraints in INR (₹), MOQ, certifications, and lead time. Vendra's deterministic policy engine enforces these constraints across every supplier quote.
        </p>
      </div>

      {/* Quick Fill Presets for Fast Testing */}
      <div
        className={`rounded-md border p-4 ${
          isLight
            ? 'border-[#E7E5E4] bg-white'
            : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <div className="mb-2.5 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#C84B31]" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">
            Quick-Fill Specification Templates (Optional)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_TEMPLATES.map((tpl) => (
            <button
              key={tpl.mission_name}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className={`rounded-[4px] border px-3 py-1.5 text-xs font-medium transition-colors ${
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

      {error && (
        <div className="rounded-[4px] border border-[#DC2626]/40 bg-[#DC2626]/10 p-3 text-xs text-[#DC2626]">
          {error}
        </div>
      )}

      <div
        className={`rounded-md border p-6 ${
          isLight
            ? 'border-[#E7E5E4] bg-white'
            : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <div className="space-y-5">
          {/* Identity */}
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
                placeholder="e.g., Bamboo Lunch Box Production"
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
                placeholder="Kitchen & Dining, Packaging, Drinkware..."
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
              placeholder="e.g., Eco-Friendly Bamboo Fiber Lunch Box (1100ml)"
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

          {/* Commercial & Quantity Constraints */}
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

          {/* Technical & Sourcing Constraints */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Material Specification *
              </label>
              <input
                type="text"
                value={form.material}
                onChange={(e) => setForm({ ...form, material: e.target.value })}
                placeholder="e.g., Natural Bamboo Fiber & Food-Grade Silicone"
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
                placeholder="e.g., Food-grade certification, FSSAI, ISO 22000"
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

          {/* Action Buttons */}
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
                ? 'Launching Autonomous Workflow...'
                : 'Launch Mission & Run Supplier Discovery + RFQs'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
