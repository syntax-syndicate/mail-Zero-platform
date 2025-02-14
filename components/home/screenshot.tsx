import Image from "next/image";

const Screenshot = () => {
  return (
    <div className="max-w-9xl mx-auto w-full overflow-hidden px-4 pt-14 md:px-0 md:pt-28">
      <div className="relative p-2 pb-0 md:p-5">
        <div className="absolute inset-0 rounded-sm rounded-b-none border border-b-0 border-white/40 bg-white/10 shadow-lg ring-1 ring-black/5 backdrop-blur-lg md:rounded-xl" />
        <div className="relative">
          <Image
            src="/screenshot.png"
            alt="app screenshot"
            width={4112 / 2}
            height={2372 / 2}
            className="rounded-md object-top"
            priority
          />
        </div>
      </div>
    </div>
  );
};

export default Screenshot;
