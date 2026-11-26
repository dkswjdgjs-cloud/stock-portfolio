import { redirect } from "next/navigation";

// 구버전 대시보드는 삭제됨. 첫 페이지는 데스크탑 화면으로 보낸다.
export default function Home() {
  redirect("/Desktop");
}
