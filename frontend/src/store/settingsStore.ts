import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* =========================================================
   Admin Platform Settings — persisted to localStorage
   ========================================================= */

interface AdminSettings {
  // API Credentials
  fredKey: string;
  resendKey: string;
  resendFrom: string;
  googleClientId: string;
  googleSecret: string;

  // Branding
  siteName: string;
  siteDesc: string;
  primaryColor: string;
  logoUrl: string;

  // SEO
  metaTitle: string;
  metaDesc: string;
  keywords: string;
  ogImage: string;

  // General
  defaultCountry: string;
  defaultLang: string;
  enableReg: boolean;
  maintenance: boolean;
}

interface AdminSettingsStore extends AdminSettings {
  updateField: <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) => void;
  updateMany: (fields: Partial<AdminSettings>) => void;
}

export const useAdminSettingsStore = create<AdminSettingsStore>()(
  persist(
    (set) => ({
      // API Credentials — defaults
      fredKey: '',
      resendKey: '',
      resendFrom: 'noreply@velora.io',
      googleClientId: '',
      googleSecret: '',

      // Branding
      siteName: 'Velora',
      siteDesc: 'AI-Powered Inflation Prediction Platform',
      primaryColor: '#FFFFFF',
      logoUrl: '',

      // SEO
      metaTitle: 'Velora — Predict Inflation with AI',
      metaDesc:
        'Leverage cutting-edge transformer models to forecast inflation trends across African economies.',
      keywords: 'inflation, prediction, AI, machine learning, Africa, Nigeria',
      ogImage: '',

      // General
      defaultCountry: 'NG',
      defaultLang: 'en',
      enableReg: true,
      maintenance: false,

      updateField: (key, value) => set({ [key]: value }),
      updateMany: (fields) => set(fields),
    }),
    { name: 'velora-admin-settings' },
  ),
);

/* =========================================================
   CMS Content Store — persisted to localStorage
   ========================================================= */

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface Testimonial {
  quote: string;
  author: string;
  title: string;
}

interface Faq {
  question: string;
  answer: string;
}

interface CmsStore {
  heroHeadline: string;
  heroSubtitle: string;
  heroCta: string;
  features: Feature[];
  testimonials: Testimonial[];
  faqs: Faq[];

  setHero: (fields: { heroHeadline?: string; heroSubtitle?: string; heroCta?: string }) => void;
  setFeatures: (features: Feature[]) => void;
  updateFeature: (idx: number, field: keyof Feature, value: string) => void;
  setTestimonials: (testimonials: Testimonial[]) => void;
  updateTestimonial: (idx: number, field: keyof Testimonial, value: string) => void;
  setFaqs: (faqs: Faq[]) => void;
  updateFaq: (idx: number, field: keyof Faq, value: string) => void;
}

export const useCmsStore = create<CmsStore>()(
  persist(
    (set) => ({
      heroHeadline: 'Predict Inflation Before It Happens',
      heroSubtitle:
        'AI-powered forecasting for African economies, powered by transformer neural networks.',
      heroCta: 'Get Started Free',

      features: [
        {
          icon: 'Brain',
          title: 'AI-Powered Predictions',
          description:
            'Transformer neural networks trained on decades of macroeconomic data.',
        },
        {
          icon: 'Globe',
          title: 'Multi-Country Coverage',
          description:
            'Track inflation trends across 15+ African economies in real time.',
        },
        {
          icon: 'TrendingUp',
          title: 'Trend Analysis',
          description:
            'Identify macro-economic shifts with our proprietary trend detection engine.',
        },
        {
          icon: 'Shield',
          title: 'Bank-Grade Security',
          description:
            'End-to-end encryption with SOC 2 Type II compliance.',
        },
        {
          icon: 'BarChart3',
          title: 'Interactive Dashboards',
          description:
            'Rich visualizations and customizable analytics dashboards.',
        },
        {
          icon: 'Zap',
          title: 'Real-Time Alerts',
          description:
            'Get notified of critical inflation changes before they impact your portfolio.',
        },
      ],

      testimonials: [
        {
          quote:
            'Velora transformed how we approach monetary policy analysis. The accuracy is remarkable.',
          author: 'Dr. Amina Yusuf',
          title: 'Chief Economist, CBN',
        },
        {
          quote:
            'We reduced our forecasting errors by 40% within the first quarter of using Velora.',
          author: 'Olumide Bankole',
          title: 'VP Analytics, GTBank',
        },
        {
          quote:
            'The most sophisticated inflation prediction tool I have used in my 20-year career.',
          author: 'Prof. Chukwuma Obi',
          title: 'Economics Dept, University of Lagos',
        },
      ],

      faqs: [
        {
          question: 'How accurate are Velora predictions?',
          answer:
            'Our TS-Transformer model achieves 97.3% accuracy on historical back-tests across all supported countries.',
        },
        {
          question: 'Which countries are supported?',
          answer:
            'We currently support Nigeria, Ghana, Kenya, South Africa, Egypt, and 10+ additional African economies.',
        },
        {
          question: 'How often are predictions updated?',
          answer:
            'Predictions are updated daily with new economic data feeds, with comprehensive re-training monthly.',
        },
        {
          question: 'Can I export the data?',
          answer:
            'Yes — all predictions, charts, and reports can be exported to CSV, PDF, and via our REST API.',
        },
        {
          question: 'Is there a free trial?',
          answer:
            'Absolutely. We offer a 14-day free trial with full access to all features, no credit card required.',
        },
        {
          question: 'How is data security handled?',
          answer:
            'We use AES-256 encryption at rest, TLS 1.3 in transit, and maintain SOC 2 Type II certification.',
        },
      ],

      setHero: (fields) => set(fields),

      setFeatures: (features) => set({ features }),
      updateFeature: (idx, field, value) =>
        set((state) => ({
          features: state.features.map((f, i) =>
            i === idx ? { ...f, [field]: value } : f,
          ),
        })),

      setTestimonials: (testimonials) => set({ testimonials }),
      updateTestimonial: (idx, field, value) =>
        set((state) => ({
          testimonials: state.testimonials.map((t, i) =>
            i === idx ? { ...t, [field]: value } : t,
          ),
        })),

      setFaqs: (faqs) => set({ faqs }),
      updateFaq: (idx, field, value) =>
        set((state) => ({
          faqs: state.faqs.map((f, i) =>
            i === idx ? { ...f, [field]: value } : f,
          ),
        })),
    }),
    { name: 'velora-cms' },
  ),
);

/* =========================================================
   User Profile Settings — persisted to localStorage
   ========================================================= */

interface UserProfileStore {
  fullName: string;
  email: string;
  phone: string;
  institution: string;
  country: string;
  defaultCountry: string;
  emailNotifications: boolean;
  darkMode: boolean;
  exportFormat: string;

  updateField: <K extends keyof Omit<UserProfileStore, 'updateField' | 'updateMany'>>(
    key: K,
    value: Omit<UserProfileStore, 'updateField' | 'updateMany'>[K],
  ) => void;
  updateMany: (
    fields: Partial<Omit<UserProfileStore, 'updateField' | 'updateMany'>>,
  ) => void;
}

export const useUserProfileStore = create<UserProfileStore>()(
  persist(
    (set) => ({
      fullName: 'Segun User',
      email: 'segun@example.com',
      phone: '+234 801 234 5678',
      institution: 'University of Lagos',
      country: 'NG',
      defaultCountry: 'NG',
      emailNotifications: true,
      darkMode: true,
      exportFormat: 'pdf',

      updateField: (key, value) => set({ [key]: value }),
      updateMany: (fields) => set(fields),
    }),
    { name: 'velora-user-profile' },
  ),
);
