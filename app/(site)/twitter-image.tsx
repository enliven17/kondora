import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/components/brand/og";

export const alt = "Kondora: every outcome has a price";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOg({
    title: "Every outcome has a price.",
    subtitle: "Leveraged YES or NO markets on Solana. AI agents open and settle every market.",
  });
}
