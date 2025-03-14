import { DemoMailLayout } from "@/components/mail/mail";
import HeroImage from "@/components/home/hero-image";
import Navbar from "@/components/home/navbar";
import Hero from "@/components/home/hero";
import Footer from "@/components/home/footer";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  return (
    <div className="relative h-screen min-h-screen w-full overflow-auto bg-black">
      <div 
        className="absolute inset-0 opacity-8[[[\0"
        style={{
          backgroundImage: `url('/noise-light.png')`,
          backgroundRepeat: 'repeat',
          backgroundSize: '100px 100px',
        }}
      />
     
      <div className="relative mx-auto mb-4 flex flex-col">
        <Suspense fallback={<Skeleton />}><Navbar /></Suspense>
        <Hero />
        <div className="container mx-auto hidden md:block mt-3 max-w-6xl">
          <DemoMailLayout />
        </div>
        <div className="container mx-auto block md:hidden">
          <HeroImage />
        </div>
        <Footer />
      </div>
    </div>
  );
}
