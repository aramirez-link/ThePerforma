import { useEffect, useState, type ReactNode } from "react";
import {
  clonePerformancePricingProfile,
  DEFAULT_PERFORMANCE_PRICING_PROFILE,
  loadActivePerformancePricingProfile,
  savePerformancePricingProfile,
  type PerformancePricingAdder,
  type PerformancePricingAmbitionMultiplier,
  type PerformancePricingAttendanceBand,
  type PerformancePricingEventRate,
  type PerformancePricingPackageTier,
  type PerformancePricingPermitAllowance,
  type PerformancePricingProfile,
  type PerformancePricingProposalSection,
  type PerformancePricingSecurityBand,
  type PerformancePricingTravelZone
} from "../lib/performancePricing";

const parseLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const linesToText = (items: string[]) => items.join("\n");

const updateArrayItem = <T,>(items: T[], index: number, patch: Partial<T>) =>
  items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));

const removeArrayItem = <T,>(items: T[], index: number) => items.filter((_, itemIndex) => itemIndex !== index);

const dollarsToCents = (value: string) => Math.round((Number(value || 0) || 0) * 100);
const centsToDollars = (value: number) => String(Number.isFinite(value) ? value / 100 : 0);

const createEventRate = (): PerformancePricingEventRate => ({
  eventType: "custom-event",
  label: "Custom Event",
  caption: "",
  baseFeeCents: 0,
  note: ""
});

const createPackageTier = (): PerformancePricingPackageTier => ({
  tier: "custom-package",
  label: "Custom Package",
  rationale: "",
  components: [],
  defaultNextStep: "availability-review",
  routeRank: 1,
  minimumAttendees: 0,
  minimumProductionNeeds: 0,
  minimumLiveElements: 0,
  requiredAmbitions: [],
  requiredEventTypes: []
});

const createAttendanceBand = (): PerformancePricingAttendanceBand => ({
  label: "New attendance band",
  maxAttendees: 0,
  multiplier: 1
});

const createAmbitionMultiplier = (): PerformancePricingAmbitionMultiplier => ({
  ambition: "custom",
  label: "Custom ambition",
  multiplier: 1
});

const createTravelZone = (): PerformancePricingTravelZone => ({
  zone: "custom",
  label: "Custom zone",
  lowCents: 0,
  highCents: 0,
  note: ""
});

const createAdder = (): PerformancePricingAdder => ({
  key: "custom-item",
  label: "Custom item",
  adderCents: 0
});

const createSecurityBand = (): PerformancePricingSecurityBand => ({
  maxAttendees: 0,
  lowCents: 0,
  highCents: 0
});

const createPermitAllowance = (): PerformancePricingPermitAllowance => ({
  key: "custom-permit",
  label: "Custom permit allowance",
  eventTypes: [],
  lowCents: 0,
  highCents: 0
});

const createProposalSection = (): PerformancePricingProposalSection => ({
  key: "custom-section",
  label: "Custom section",
  guidance: ""
});

export default function PerformanceControlPanel() {
  const [profile, setProfile] = useState<PerformancePricingProfile>(
    clonePerformancePricingProfile(DEFAULT_PERFORMANCE_PRICING_PROFILE)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void (async () => {
      const result = await loadActivePerformancePricingProfile();
      if (result.ok) {
        setProfile(result.data);
      } else {
        setNotice(result.error);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const saveProfile = async () => {
    setSaving(true);
    const result = await savePerformancePricingProfile(profile);
    setSaving(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setProfile(result.data);
    setNotice("Performance pricing profile saved.");
  };

  return (
    <article className="rounded-3xl border border-white/15 bg-black/35 p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-gold/80">Performance Control</p>
          <h2 className="mt-2 font-display text-2xl text-white">Booking / Proposal Rate Card</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
            This profile drives preliminary performance pricing, proposal structure, and the operational booking data
            the booking AI uses when shaping quotes and buyer-facing language.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setProfile(clonePerformancePricingProfile(DEFAULT_PERFORMANCE_PRICING_PROFILE));
              setNotice("Restored the panel to the default performance profile.");
            }}
            className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75"
          >
            Restore Defaults
          </button>
          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={saving || loading}
            className="min-h-10 rounded-full bg-ember px-5 py-2 text-[10px] uppercase tracking-[0.22em] text-ink disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Performance Profile"}
          </button>
        </div>
      </div>

      {notice && <p className="mt-4 text-sm text-gold">{notice}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-white/65">Loading performance profile...</p>
      ) : (
        <div className="mt-5 space-y-4">
          <ExpandableSection
            title="Profile Overview"
            description="Core naming, buyer framing, and AI guidance for the performance profile."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="Profile name"
                value={profile.profileName}
                onChange={(value) => setProfile((current) => ({ ...current, profileName: value }))}
              />
              <TextField
                label="Profile key"
                value={profile.profileKey}
                onChange={(value) => setProfile((current) => ({ ...current, profileKey: value.toLowerCase().replace(/\s+/g, "-") }))}
              />
              <TextField
                label="Artist / act name"
                value={profile.artistName}
                onChange={(value) => setProfile((current) => ({ ...current, artistName: value }))}
              />
              <TextField
                label="Currency"
                value={profile.currency}
                onChange={(value) => setProfile((current) => ({ ...current, currency: value.toLowerCase() }))}
              />
              <ToggleField
                label="Active profile"
                checked={profile.isActive}
                onChange={(checked) => setProfile((current) => ({ ...current, isActive: checked }))}
              />
            </div>
            <div className="mt-3 grid gap-3">
              <TextareaField
                label="Base overview"
                rows={3}
                value={profile.baseOverview}
                onChange={(value) => setProfile((current) => ({ ...current, baseOverview: value }))}
              />
              <TextareaField
                label="AI guidance"
                rows={4}
                value={profile.aiGuidance}
                onChange={(value) => setProfile((current) => ({ ...current, aiGuidance: value }))}
              />
            </div>
          </ExpandableSection>

          <ExpandableSection
            title="Performance Booking Database"
            description="Operational booking facts used by AI to generate proposals that read like a real performance brief."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <NumberField
                label="Minimum lead time (days)"
                value={profile.metadata.minimumLeadTimeDays}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, minimumLeadTimeDays: value }
                  }))
                }
              />
              <NumberField
                label="Default set length (minutes)"
                value={profile.metadata.defaultSetLengthMinutes}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, defaultSetLengthMinutes: value }
                  }))
                }
              />
              <NumberField
                label="Performance window (minutes)"
                value={profile.metadata.typicalPerformanceWindowMinutes}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, typicalPerformanceWindowMinutes: value }
                  }))
                }
              />
              <NumberField
                label="Travel party size"
                value={profile.metadata.travelPartySize}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, travelPartySize: value }
                  }))
                }
              />
              <NumberField
                label="Hotel rooms required"
                value={profile.metadata.hotelRoomsRequired}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, hotelRoomsRequired: value }
                  }))
                }
              />
              <NumberField
                label="Local ground seats"
                value={profile.metadata.localGroundSeats}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, localGroundSeats: value }
                  }))
                }
              />
              <ToggleField
                label="Soundcheck required"
                checked={profile.metadata.soundcheckRequired}
                onChange={(checked) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, soundcheckRequired: checked }
                  }))
                }
              />
              <ToggleField
                label="Meet and greet available"
                checked={profile.metadata.meetAndGreetAvailable}
                onChange={(checked) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, meetAndGreetAvailable: checked }
                  }))
                }
              />
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <TextareaField
                label="Performance formats"
                rows={4}
                value={linesToText(profile.metadata.performanceFormats)}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, performanceFormats: parseLines(value) }
                  }))
                }
              />
              <TextareaField
                label="Ideal audience tags"
                rows={4}
                value={linesToText(profile.metadata.idealAudienceTags)}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, idealAudienceTags: parseLines(value) }
                  }))
                }
              />
              <TextareaField
                label="Deliverables"
                rows={4}
                value={linesToText(profile.metadata.deliverables)}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, deliverables: parseLines(value) }
                  }))
                }
              />
              <TextareaField
                label="Technical requirements"
                rows={4}
                value={linesToText(profile.metadata.technicalRequirements)}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, technicalRequirements: parseLines(value) }
                  }))
                }
              />
              <TextareaField
                label="Hospitality requirements"
                rows={4}
                value={linesToText(profile.metadata.hospitalityRequirements)}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, hospitalityRequirements: parseLines(value) }
                  }))
                }
              />
              <TextareaField
                label="Travel notes"
                rows={4}
                value={linesToText(profile.metadata.travelNotes)}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, travelNotes: parseLines(value) }
                  }))
                }
              />
              <TextareaField
                label="Booking requirements"
                rows={4}
                value={linesToText(profile.metadata.bookingRequirements)}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, bookingRequirements: parseLines(value) }
                  }))
                }
              />
              <TextareaField
                label="Proposal callouts"
                rows={4}
                value={linesToText(profile.metadata.proposalCallouts)}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, proposalCallouts: parseLines(value) }
                  }))
                }
              />
            </div>
            <div className="mt-3">
              <TextareaField
                label="Content capture policy"
                rows={3}
                value={profile.metadata.contentCapturePolicy}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    metadata: { ...current.metadata, contentCapturePolicy: value }
                  }))
                }
              />
            </div>
          </ExpandableSection>

          <ExpandableSection
            title="Commercial Terms"
            description="Deposit logic, contingency, and base commercial assumptions used across proposals."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <NumberField
                label="Deposit percent"
                value={profile.commercialTerms.depositPercent}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    commercialTerms: { ...current.commercialTerms, depositPercent: value }
                  }))
                }
              />
              <NumberField
                label="Balance due days"
                value={profile.commercialTerms.balanceDueDays}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    commercialTerms: { ...current.commercialTerms, balanceDueDays: value }
                  }))
                }
              />
              <NumberField
                label="Hold window days"
                value={profile.commercialTerms.holdWindowDays}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    commercialTerms: { ...current.commercialTerms, holdWindowDays: value }
                  }))
                }
              />
              <NumberField
                label="Proposal validity days"
                value={profile.commercialTerms.proposalValidityDays}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    commercialTerms: { ...current.commercialTerms, proposalValidityDays: value }
                  }))
                }
              />
              <NumberField
                label="Low contingency percent"
                value={profile.commercialTerms.contingencyLowPercent}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    commercialTerms: { ...current.commercialTerms, contingencyLowPercent: value }
                  }))
                }
              />
              <NumberField
                label="High contingency percent"
                value={profile.commercialTerms.contingencyHighPercent}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    commercialTerms: { ...current.commercialTerms, contingencyHighPercent: value }
                  }))
                }
              />
              <MoneyField
                label="Brand integration low"
                value={profile.commercialTerms.brandIntegrationLowCents}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    commercialTerms: { ...current.commercialTerms, brandIntegrationLowCents: value }
                  }))
                }
              />
              <MoneyField
                label="Brand integration high"
                value={profile.commercialTerms.brandIntegrationHighCents}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    commercialTerms: { ...current.commercialTerms, brandIntegrationHighCents: value }
                  }))
                }
              />
              <MoneyField
                label="Host / MC low"
                value={profile.commercialTerms.hostMomentsLowCents}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    commercialTerms: { ...current.commercialTerms, hostMomentsLowCents: value }
                  }))
                }
              />
              <MoneyField
                label="Host / MC high"
                value={profile.commercialTerms.hostMomentsHighCents}
                onChange={(value) =>
                  setProfile((current) => ({
                    ...current,
                    commercialTerms: { ...current.commercialTerms, hostMomentsHighCents: value }
                  }))
                }
              />
            </div>
          </ExpandableSection>

          <ExpandableSection
            title="Event Base Rates"
            description="Starting fee logic by event type before scale, travel, and scope multipliers."
          >
            <div className="space-y-3">
              {profile.eventTypeRates.map((rate, index) => (
                <CardRow
                  key={`${rate.eventType}-${index}`}
                  title={rate.label || `Event rate ${index + 1}`}
                  onRemove={() =>
                    setProfile((current) => ({
                      ...current,
                      eventTypeRates: removeArrayItem(current.eventTypeRates, index)
                    }))
                  }
                >
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <TextField
                      label="Event type key"
                      value={rate.eventType}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          eventTypeRates: updateArrayItem(current.eventTypeRates, index, { eventType: value })
                        }))
                      }
                    />
                    <TextField
                      label="Label"
                      value={rate.label}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          eventTypeRates: updateArrayItem(current.eventTypeRates, index, { label: value })
                        }))
                      }
                    />
                    <MoneyField
                      label="Base fee"
                      value={rate.baseFeeCents}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          eventTypeRates: updateArrayItem(current.eventTypeRates, index, { baseFeeCents: value })
                        }))
                      }
                    />
                    <TextField
                      label="Caption"
                      value={rate.caption}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          eventTypeRates: updateArrayItem(current.eventTypeRates, index, { caption: value })
                        }))
                      }
                    />
                  </div>
                  <div className="mt-3">
                    <TextareaField
                      label="Pricing note"
                      rows={2}
                      value={rate.note}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          eventTypeRates: updateArrayItem(current.eventTypeRates, index, { note: value })
                        }))
                      }
                    />
                  </div>
                </CardRow>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setProfile((current) => ({
                  ...current,
                  eventTypeRates: [...current.eventTypeRates, createEventRate()]
                }))
              }
              className="mt-3 min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75"
            >
              Add Event Rate
            </button>
          </ExpandableSection>

          <ExpandableSection
            title="Package Tiers"
            description="Routing logic for the package recommendation the booking flow surfaces to users and AI."
          >
            <div className="space-y-3">
              {profile.packageTiers.map((tier, index) => (
                <CardRow
                  key={`${tier.tier}-${index}`}
                  title={tier.label || `Package tier ${index + 1}`}
                  onRemove={() =>
                    setProfile((current) => ({
                      ...current,
                      packageTiers: removeArrayItem(current.packageTiers, index)
                    }))
                  }
                >
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <TextField
                      label="Tier key"
                      value={tier.tier}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          packageTiers: updateArrayItem(current.packageTiers, index, { tier: value })
                        }))
                      }
                    />
                    <TextField
                      label="Label"
                      value={tier.label}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          packageTiers: updateArrayItem(current.packageTiers, index, { label: value })
                        }))
                      }
                    />
                    <TextField
                      label="Default next step"
                      value={tier.defaultNextStep}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          packageTiers: updateArrayItem(current.packageTiers, index, { defaultNextStep: value })
                        }))
                      }
                    />
                    <NumberField
                      label="Route rank"
                      value={tier.routeRank}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          packageTiers: updateArrayItem(current.packageTiers, index, { routeRank: value })
                        }))
                      }
                    />
                    <NumberField
                      label="Minimum attendees"
                      value={tier.minimumAttendees}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          packageTiers: updateArrayItem(current.packageTiers, index, { minimumAttendees: value })
                        }))
                      }
                    />
                    <NumberField
                      label="Minimum production needs"
                      value={tier.minimumProductionNeeds}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          packageTiers: updateArrayItem(current.packageTiers, index, { minimumProductionNeeds: value })
                        }))
                      }
                    />
                    <NumberField
                      label="Minimum live elements"
                      value={tier.minimumLiveElements}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          packageTiers: updateArrayItem(current.packageTiers, index, { minimumLiveElements: value })
                        }))
                      }
                    />
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <TextareaField
                      label="Rationale"
                      rows={3}
                      value={tier.rationale}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          packageTiers: updateArrayItem(current.packageTiers, index, { rationale: value })
                        }))
                      }
                    />
                    <TextareaField
                      label="Components"
                      rows={3}
                      value={linesToText(tier.components)}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          packageTiers: updateArrayItem(current.packageTiers, index, { components: parseLines(value) })
                        }))
                      }
                    />
                    <TextareaField
                      label="Required ambitions"
                      rows={3}
                      value={linesToText(tier.requiredAmbitions)}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          packageTiers: updateArrayItem(current.packageTiers, index, { requiredAmbitions: parseLines(value) })
                        }))
                      }
                    />
                    <TextareaField
                      label="Required event types"
                      rows={3}
                      value={linesToText(tier.requiredEventTypes)}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          packageTiers: updateArrayItem(current.packageTiers, index, { requiredEventTypes: parseLines(value) })
                        }))
                      }
                    />
                  </div>
                </CardRow>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setProfile((current) => ({
                  ...current,
                  packageTiers: [...current.packageTiers, createPackageTier()]
                }))
              }
              className="mt-3 min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75"
            >
              Add Package Tier
            </button>
          </ExpandableSection>

          <ExpandableSection
            title="Scale, Ambition, and Travel"
            description="Multipliers and routing logic that shape performance pricing before adders and contingency."
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <ArrayColumn title="Attendance bands">
                {profile.attendanceBands.map((band, index) => (
                  <SmallCard
                    key={`${band.label}-${index}`}
                    onRemove={() =>
                      setProfile((current) => ({
                        ...current,
                        attendanceBands: removeArrayItem(current.attendanceBands, index)
                      }))
                    }
                  >
                    <TextField
                      label="Label"
                      value={band.label}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          attendanceBands: updateArrayItem(current.attendanceBands, index, { label: value })
                        }))
                      }
                    />
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <NumberField
                        label="Max attendees"
                        value={band.maxAttendees}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            attendanceBands: updateArrayItem(current.attendanceBands, index, { maxAttendees: value })
                          }))
                        }
                      />
                      <DecimalField
                        label="Multiplier"
                        value={band.multiplier}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            attendanceBands: updateArrayItem(current.attendanceBands, index, { multiplier: value })
                          }))
                        }
                      />
                    </div>
                  </SmallCard>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setProfile((current) => ({
                      ...current,
                      attendanceBands: [...current.attendanceBands, createAttendanceBand()]
                    }))
                  }
                  className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75"
                >
                  Add Band
                </button>
              </ArrayColumn>

              <ArrayColumn title="Ambition multipliers">
                {profile.ambitionMultipliers.map((item, index) => (
                  <SmallCard
                    key={`${item.ambition}-${index}`}
                    onRemove={() =>
                      setProfile((current) => ({
                        ...current,
                        ambitionMultipliers: removeArrayItem(current.ambitionMultipliers, index)
                      }))
                    }
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <TextField
                        label="Ambition key"
                        value={item.ambition}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            ambitionMultipliers: updateArrayItem(current.ambitionMultipliers, index, { ambition: value })
                          }))
                        }
                      />
                      <TextField
                        label="Label"
                        value={item.label}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            ambitionMultipliers: updateArrayItem(current.ambitionMultipliers, index, { label: value })
                          }))
                        }
                      />
                    </div>
                    <div className="mt-3">
                      <DecimalField
                        label="Multiplier"
                        value={item.multiplier}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            ambitionMultipliers: updateArrayItem(current.ambitionMultipliers, index, { multiplier: value })
                          }))
                        }
                      />
                    </div>
                  </SmallCard>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setProfile((current) => ({
                      ...current,
                      ambitionMultipliers: [...current.ambitionMultipliers, createAmbitionMultiplier()]
                    }))
                  }
                  className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75"
                >
                  Add Ambition
                </button>
              </ArrayColumn>

              <ArrayColumn title="Travel zones">
                {profile.travelZones.map((zone, index) => (
                  <SmallCard
                    key={`${zone.zone}-${index}`}
                    onRemove={() =>
                      setProfile((current) => ({
                        ...current,
                        travelZones: removeArrayItem(current.travelZones, index)
                      }))
                    }
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <TextField
                        label="Zone key"
                        value={zone.zone}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            travelZones: updateArrayItem(current.travelZones, index, { zone: value })
                          }))
                        }
                      />
                      <TextField
                        label="Label"
                        value={zone.label}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            travelZones: updateArrayItem(current.travelZones, index, { label: value })
                          }))
                        }
                      />
                      <MoneyField
                        label="Low"
                        value={zone.lowCents}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            travelZones: updateArrayItem(current.travelZones, index, { lowCents: value })
                          }))
                        }
                      />
                      <MoneyField
                        label="High"
                        value={zone.highCents}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            travelZones: updateArrayItem(current.travelZones, index, { highCents: value })
                          }))
                        }
                      />
                    </div>
                    <div className="mt-3">
                      <TextareaField
                        label="Routing note"
                        rows={2}
                        value={zone.note}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            travelZones: updateArrayItem(current.travelZones, index, { note: value })
                          }))
                        }
                      />
                    </div>
                  </SmallCard>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setProfile((current) => ({
                      ...current,
                      travelZones: [...current.travelZones, createTravelZone()]
                    }))
                  }
                  className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75"
                >
                  Add Travel Zone
                </button>
              </ArrayColumn>
            </div>
          </ExpandableSection>

          <ExpandableSection
            title="Scope Adders and Production Guardrails"
            description="Live elements, production adders, security, permit placeholders, and staffing assumptions."
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <ArrayColumn title="Live element adders">
                {profile.liveElementRates.map((item, index) => (
                  <SmallCard
                    key={`${item.key}-${index}`}
                    onRemove={() =>
                      setProfile((current) => ({
                        ...current,
                        liveElementRates: removeArrayItem(current.liveElementRates, index)
                      }))
                    }
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <TextField
                        label="Key"
                        value={item.key}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            liveElementRates: updateArrayItem(current.liveElementRates, index, { key: value })
                          }))
                        }
                      />
                      <TextField
                        label="Label"
                        value={item.label}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            liveElementRates: updateArrayItem(current.liveElementRates, index, { label: value })
                          }))
                        }
                      />
                    </div>
                    <div className="mt-3">
                      <MoneyField
                        label="Adder"
                        value={item.adderCents}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            liveElementRates: updateArrayItem(current.liveElementRates, index, { adderCents: value })
                          }))
                        }
                      />
                    </div>
                  </SmallCard>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setProfile((current) => ({
                      ...current,
                      liveElementRates: [...current.liveElementRates, createAdder()]
                    }))
                  }
                  className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75"
                >
                  Add Live Element
                </button>
              </ArrayColumn>

              <ArrayColumn title="Production adders">
                {profile.productionNeedRates.map((item, index) => (
                  <SmallCard
                    key={`${item.key}-${index}`}
                    onRemove={() =>
                      setProfile((current) => ({
                        ...current,
                        productionNeedRates: removeArrayItem(current.productionNeedRates, index)
                      }))
                    }
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <TextField
                        label="Key"
                        value={item.key}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            productionNeedRates: updateArrayItem(current.productionNeedRates, index, { key: value })
                          }))
                        }
                      />
                      <TextField
                        label="Label"
                        value={item.label}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            productionNeedRates: updateArrayItem(current.productionNeedRates, index, { label: value })
                          }))
                        }
                      />
                    </div>
                    <div className="mt-3">
                      <MoneyField
                        label="Adder"
                        value={item.adderCents}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            productionNeedRates: updateArrayItem(current.productionNeedRates, index, { adderCents: value })
                          }))
                        }
                      />
                    </div>
                  </SmallCard>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setProfile((current) => ({
                      ...current,
                      productionNeedRates: [...current.productionNeedRates, createAdder()]
                    }))
                  }
                  className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75"
                >
                  Add Production Need
                </button>
              </ArrayColumn>

              <ArrayColumn title="Security bands">
                {profile.securityBands.map((band, index) => (
                  <SmallCard
                    key={`${band.maxAttendees}-${index}`}
                    onRemove={() =>
                      setProfile((current) => ({
                        ...current,
                        securityBands: removeArrayItem(current.securityBands, index)
                      }))
                    }
                  >
                    <div className="grid gap-3 md:grid-cols-3">
                      <NumberField
                        label="Max attendees"
                        value={band.maxAttendees}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            securityBands: updateArrayItem(current.securityBands, index, { maxAttendees: value })
                          }))
                        }
                      />
                      <MoneyField
                        label="Low"
                        value={band.lowCents}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            securityBands: updateArrayItem(current.securityBands, index, { lowCents: value })
                          }))
                        }
                      />
                      <MoneyField
                        label="High"
                        value={band.highCents}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            securityBands: updateArrayItem(current.securityBands, index, { highCents: value })
                          }))
                        }
                      />
                    </div>
                  </SmallCard>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setProfile((current) => ({
                      ...current,
                      securityBands: [...current.securityBands, createSecurityBand()]
                    }))
                  }
                  className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75"
                >
                  Add Security Band
                </button>
              </ArrayColumn>

              <ArrayColumn title="Permit allowances">
                {profile.permitAllowances.map((item, index) => (
                  <SmallCard
                    key={`${item.key}-${index}`}
                    onRemove={() =>
                      setProfile((current) => ({
                        ...current,
                        permitAllowances: removeArrayItem(current.permitAllowances, index)
                      }))
                    }
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <TextField
                        label="Key"
                        value={item.key}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            permitAllowances: updateArrayItem(current.permitAllowances, index, { key: value })
                          }))
                        }
                      />
                      <TextField
                        label="Label"
                        value={item.label}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            permitAllowances: updateArrayItem(current.permitAllowances, index, { label: value })
                          }))
                        }
                      />
                      <MoneyField
                        label="Low"
                        value={item.lowCents}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            permitAllowances: updateArrayItem(current.permitAllowances, index, { lowCents: value })
                          }))
                        }
                      />
                      <MoneyField
                        label="High"
                        value={item.highCents}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            permitAllowances: updateArrayItem(current.permitAllowances, index, { highCents: value })
                          }))
                        }
                      />
                    </div>
                    <div className="mt-3">
                      <TextareaField
                        label="Event types"
                        rows={3}
                        value={linesToText(item.eventTypes)}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            permitAllowances: updateArrayItem(current.permitAllowances, index, { eventTypes: parseLines(value) })
                          }))
                        }
                      />
                    </div>
                  </SmallCard>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setProfile((current) => ({
                      ...current,
                      permitAllowances: [...current.permitAllowances, createPermitAllowance()]
                    }))
                  }
                  className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75"
                >
                  Add Permit Allowance
                </button>
              </ArrayColumn>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-gold/80">Staffing formula</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <MoneyField
                  label="Base low"
                  value={profile.staffingFormula.baseLowCents}
                  onChange={(value) =>
                    setProfile((current) => ({
                      ...current,
                      staffingFormula: { ...current.staffingFormula, baseLowCents: value }
                    }))
                  }
                />
                <MoneyField
                  label="Base high adder"
                  value={profile.staffingFormula.baseHighCents}
                  onChange={(value) =>
                    setProfile((current) => ({
                      ...current,
                      staffingFormula: { ...current.staffingFormula, baseHighCents: value }
                    }))
                  }
                />
                <MoneyField
                  label="Live support low adder"
                  value={profile.staffingFormula.liveElementSupportLowCents}
                  onChange={(value) =>
                    setProfile((current) => ({
                      ...current,
                      staffingFormula: { ...current.staffingFormula, liveElementSupportLowCents: value }
                    }))
                  }
                />
                <NumberField
                  label="Large room threshold"
                  value={profile.staffingFormula.largeRoomThreshold}
                  onChange={(value) =>
                    setProfile((current) => ({
                      ...current,
                      staffingFormula: { ...current.staffingFormula, largeRoomThreshold: value }
                    }))
                  }
                />
                <MoneyField
                  label="Large room low adder"
                  value={profile.staffingFormula.largeRoomLowAdderCents}
                  onChange={(value) =>
                    setProfile((current) => ({
                      ...current,
                      staffingFormula: { ...current.staffingFormula, largeRoomLowAdderCents: value }
                    }))
                  }
                />
                <MoneyField
                  label="Production need high adder"
                  value={profile.staffingFormula.productionNeedHighAdderCents}
                  onChange={(value) =>
                    setProfile((current) => ({
                      ...current,
                      staffingFormula: { ...current.staffingFormula, productionNeedHighAdderCents: value }
                    }))
                  }
                />
              </div>
              <div className="mt-3">
                <TextareaField
                  label="Assumption lines"
                  rows={4}
                  value={linesToText(profile.staffingFormula.assumptionLines)}
                  onChange={(value) =>
                    setProfile((current) => ({
                      ...current,
                      staffingFormula: { ...current.staffingFormula, assumptionLines: parseLines(value) }
                    }))
                  }
                />
              </div>
            </div>
          </ExpandableSection>

          <ExpandableSection
            title="Proposal Structure"
            description="The sections and guidance the booking AI should use when converting scope into a polished proposal."
          >
            <div className="space-y-3">
              {profile.proposalSections.map((section, index) => (
                <CardRow
                  key={`${section.key}-${index}`}
                  title={section.label || `Proposal section ${index + 1}`}
                  onRemove={() =>
                    setProfile((current) => ({
                      ...current,
                      proposalSections: removeArrayItem(current.proposalSections, index)
                    }))
                  }
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextField
                      label="Section key"
                      value={section.key}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          proposalSections: updateArrayItem(current.proposalSections, index, { key: value })
                        }))
                      }
                    />
                    <TextField
                      label="Label"
                      value={section.label}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          proposalSections: updateArrayItem(current.proposalSections, index, { label: value })
                        }))
                      }
                    />
                  </div>
                  <div className="mt-3">
                    <TextareaField
                      label="Guidance"
                      rows={3}
                      value={section.guidance}
                      onChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          proposalSections: updateArrayItem(current.proposalSections, index, { guidance: value })
                        }))
                      }
                    />
                  </div>
                </CardRow>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setProfile((current) => ({
                  ...current,
                  proposalSections: [...current.proposalSections, createProposalSection()]
                }))
              }
              className="mt-3 min-h-10 rounded-full border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/75"
            >
              Add Proposal Section
            </button>
          </ExpandableSection>
        </div>
      )}
    </article>
  );
}

function ExpandableSection({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details open className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <summary className="cursor-pointer list-none">
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/72">{title}</p>
        <p className="mt-2 text-sm text-white/55">{description}</p>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function CardRow({
  title,
  onRemove,
  children
}: {
  title: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/88">{title}</p>
        <button
          type="button"
          onClick={onRemove}
          className="min-h-9 rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/65"
        >
          Remove
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ArrayColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-[10px] uppercase tracking-[0.24em] text-gold/80">{title}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function SmallCard({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="min-h-8 rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60"
        >
          Remove
        </button>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function FieldShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] uppercase tracking-[0.22em] text-white/52">{label}</span>
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FieldShell label={label}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
      />
    </FieldShell>
  );
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <FieldShell label={label}>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
      />
    </FieldShell>
  );
}

function DecimalField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <FieldShell label={label}>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
      />
    </FieldShell>
  );
}

function MoneyField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <FieldShell label={label}>
      <input
        type="number"
        step="0.01"
        value={centsToDollars(value)}
        onChange={(event) => onChange(dollarsToCents(event.target.value))}
        className="min-h-11 rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
      />
    </FieldShell>
  );
}

function TextareaField({
  label,
  value,
  rows,
  onChange
}: {
  label: string;
  value: string;
  rows: number;
  onChange: (value: string) => void;
}) {
  return (
    <FieldShell label={label}>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
      />
    </FieldShell>
  );
}

function ToggleField({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white/82">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
