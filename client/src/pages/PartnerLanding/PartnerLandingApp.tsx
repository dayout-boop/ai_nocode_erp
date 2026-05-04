import Navbar from './Navbar'
import HeroSection from './HeroSection'
import TechBanner from './TechBanner'
import ChatbotSection from './ChatbotSection'
import DevHistorySection from './DevHistorySection'
import PricingSection from './PricingSection'
import SampleSiteSection from './SampleSiteSection'
import JoinFlowSection from './JoinFlowSection'
import CTASection from './CTASection'
import Footer from './Footer'

export default function PartnerLandingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'oklch(0.09 0.03 260)' }}>
      <Navbar />
      <main>
        <HeroSection />
        <TechBanner />
        <ChatbotSection />
        <DevHistorySection />
        <PricingSection />
        <SampleSiteSection />
        <JoinFlowSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
