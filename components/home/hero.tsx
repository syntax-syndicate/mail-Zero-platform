import Balancer from "react-wrap-balancer";

export default function Hero() {
  return (
    <div className="mx-auto w-full max-w-2xl pt-14 md:pt-28">
      <Balancer className="text-center text-5xl font-medium sm:text-7xl">
        Your open source Gmail alternative
      </Balancer>
    </div>
  );
}
