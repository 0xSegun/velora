import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import LandingAmbient from "@/components/landing/LandingAmbient";
import DashboardPreview from "@/components/landing/DashboardPreview";
import TrustedBy from "@/components/landing/TrustedBy";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import IntelligenceShowcase from "@/components/landing/IntelligenceShowcase";
import LivePreview from "@/components/landing/LivePreview";
import Statistics from "@/components/landing/Statistics";
import Testimonials from "@/components/landing/Testimonials";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] relative overflow-x-hidden">
      <LandingAmbient />
      <div className="relative z-10">
        <Navbar />
        <Hero />
        <DashboardPreview />
        <TrustedBy />
        <Features />
        <HowItWorks />
        <IntelligenceShowcase />
        <LivePreview />
        <Statistics />
        <Testimonials />
        <FAQ />
        <CTA />
        <Footer />
        <ScrollToTop />
      </div>
    </main>
  );
}