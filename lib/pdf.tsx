import path from "path";
import React from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BookPage } from "./book";

// 21×21 cm at 72pt/inch = 595.28pt. Print services accept this square format.
const PAGE = 595.28;

const fontsDir = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Cormorant",
  fonts: [
    { src: path.join(fontsDir, "Cormorant-Regular.ttf") },
    { src: path.join(fontsDir, "Cormorant-Italic.ttf"), fontStyle: "italic" },
  ],
});
Font.register({ family: "Marck", src: path.join(fontsDir, "MarckScript.ttf") });
// Keep long words from being hyphenated mid-name.
Font.registerHyphenationCallback((word) => [word]);

const INK = "#2b2622";
const SOFT = "#6f675f";
const PAPER = "#f7f4ee";

const s = StyleSheet.create({
  page: { backgroundColor: PAPER, paddingTop: 48, paddingHorizontal: 48, paddingBottom: 64, flexDirection: "column" },
  month: { fontFamily: "Helvetica", fontSize: 7, letterSpacing: 2.2, color: SOFT, textAlign: "center", marginBottom: 14 },
  // Photo pages are photo-first: the title is a small caption (owner 2026-07-22).
  title: { fontFamily: "Cormorant", fontStyle: "italic", fontSize: 16, color: INK, textAlign: "center" },
  message: { fontFamily: "Marck", fontSize: 15, color: SOFT, textAlign: "center", marginTop: 8, lineHeight: 1.45 },
  messageBig: { fontFamily: "Marck", fontSize: 18, color: SOFT, textAlign: "center", lineHeight: 1.55 },
  titleBig: { fontFamily: "Cormorant", fontStyle: "italic", fontSize: 32, color: INK, textAlign: "center", marginBottom: 12 },
  date: { fontFamily: "Helvetica", fontSize: 7, letterSpacing: 2, color: SOFT, textAlign: "center" },
  milestone: { fontFamily: "Helvetica", fontSize: 6.5, letterSpacing: 2, color: SOFT, textAlign: "center", marginTop: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 },
  print: { backgroundColor: "#ffffff", padding: 5, borderWidth: 0.5, borderColor: "#d9d3c9" },
  img: { objectFit: "cover" },
  pageNo: { position: "absolute", bottom: 16, fontFamily: "Helvetica", fontSize: 7, color: SOFT },
  // bottom 26pt ≈ the app page's bottom-5 proportionally — date sits low,
  // clear of the photo frames (owner request 2026-07-22).
  dateAbs: { position: "absolute", bottom: 26, left: 0, right: 0, fontFamily: "Helvetica", fontSize: 7, letterSpacing: 2, color: SOFT, textAlign: "center" },
});

function capsDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();
}

export interface PdfPageData {
  page: BookPage;
  images: string[]; // data URIs, aligned with page.photos (unloadable ones removed)
}

function PhotoBlock({ images }: { images: string[] }) {
  const size = images.length === 1 ? 350 : images.length === 2 ? 220 : 195;
  return (
    <View style={s.grid}>
      {images.map((src, i) => (
        <View key={i} style={s.print}>
          <Image src={src} style={[s.img, { width: size, height: size }]} />
        </View>
      ))}
    </View>
  );
}

export type PdfPart = "all" | "interior" | "cover";

export function AlbumPdf({
  babyName,
  albumTitle,
  pages,
  part = "all",
}: {
  babyName: string;
  albumTitle?: string | null;
  pages: PdfPageData[];
  part?: PdfPart;
}) {
  const withCover = part !== "interior";
  const withPages = part !== "cover";
  return (
    <Document title={`${babyName} — Voice Memory Album`}>
      {withCover && (
        <Page size={[PAGE, PAGE]} style={[s.page, { justifyContent: "center" }]} wrap={false}>
          <Text style={[s.titleBig, { fontSize: albumTitle ? 38 : 44 }]}>
            {albumTitle ?? babyName}
          </Text>
        </Page>
      )}
      {withPages &&

      pages.map(({ page, images }, i) => {
        const { entry } = page;
        const numberStyle = [
          s.pageNo,
          page.side === "left" ? { left: 24 } : { right: 24 },
        ];
        return (
          <Page key={entry.id} size={[PAGE, PAGE]} style={s.page} wrap={false}>
            {page.monthLabel && (
              <Text style={s.month}>{page.monthLabel.toUpperCase()}</Text>
            )}
            {images.length > 0 ? (
              <>
                {/* Photo-first page: caption title only, no summary — it
                    lives on photoless pages and in the app journal. */}
                <Text style={[s.title, { maxLines: 2 }]}>{entry.title}</Text>
                {entry.isMilestone && <Text style={s.milestone}>— MILESTONE —</Text>}
                <View style={{ flex: 1, justifyContent: "center" }}>
                  <PhotoBlock images={images} />
                </View>
              </>
            ) : (
              <>
                <View style={{ flex: 1, justifyContent: "center" }}>
                  <Text style={s.titleBig}>{entry.title}</Text>
                  <Text style={s.messageBig}>{entry.summary}</Text>
                  {entry.isMilestone && <Text style={s.milestone}>— MILESTONE —</Text>}
                </View>
              </>
            )}
            <Text style={s.dateAbs}>{capsDate(entry.recordedAt)}</Text>
            <Text style={numberStyle}>{i + 1}</Text>
          </Page>
        );
      })}
    </Document>
  );
}
