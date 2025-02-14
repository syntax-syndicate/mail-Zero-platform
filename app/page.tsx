import Screenshot from "@/components/home/screenshot";
import Navbar from "@/components/home/navbar";
import Hero from "@/components/home/hero";

export default function BetaSignup() {
  return (
    <div className="relative h-screen min-h-screen w-full overflow-hidden bg-grid-small-black/[0.12] dark:bg-grid-small-white/[0.025]">
      {/* Radial gradient for the container to give a faded look */}
      {/* <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[300px] w-[300px] bg-gradient-to-r from-pink-300/5 via-yellow-300/5 to-green-300/5 blur-[200px] rounded-full" />
      </div> */}
      <div className="relative mx-auto flex max-w-7xl flex-col">
        <Navbar />
        <Hero />
        <Screenshot />
      </div>
    </div>
  );
}
