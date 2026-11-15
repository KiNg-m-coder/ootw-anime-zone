
"use client";

type LionMascotProps = {
  roarTrigger?: number;
  size?: number;
};

export default function LionMascot({
  roarTrigger = 0,
  size = 260,
}: LionMascotProps) {
  return (
    <div
      className="flex justify-center items-center"
      style={{ width: "100%" }}
    >
      <img
        key={roarTrigger}
        src="/lion.gif"
        alt="OOTW anime lion mascot roaring"
        width={size}
        height={size}
        className="object-contain"
        style={{ maxWidth: "100%", height: "auto" }}
      />
    </div>
  );
}
