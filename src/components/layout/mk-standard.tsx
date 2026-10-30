// MKPA 統一標準：電子名片、列印頁頭（對應 _standard/snippets.html）
import { useEffect, useRef, useSyncExternalStore } from "react";
const ECARD_URL = "https://api.portfoplus.com/api/v1/adviser/5e41564ab3b1bc00153394db?m=link&r=adviser";
const ECARD_QR = `<svg viewBox="0 0 41 41" width="90" height="90" shape-rendering="crispEdges" aria-label="電子名片二維碼"><rect width="41" height="41" fill="#fff"/><path d="M2,2h1v1h-1zM3,2h1v1h-1zM4,2h1v1h-1zM5,2h1v1h-1zM6,2h1v1h-1zM7,2h1v1h-1zM8,2h1v1h-1zM11,2h1v1h-1zM16,2h1v1h-1zM19,2h1v1h-1zM20,2h1v1h-1zM21,2h1v1h-1zM22,2h1v1h-1zM25,2h1v1h-1zM28,2h1v1h-1zM32,2h1v1h-1zM33,2h1v1h-1zM34,2h1v1h-1zM35,2h1v1h-1zM36,2h1v1h-1zM37,2h1v1h-1zM38,2h1v1h-1zM2,3h1v1h-1zM8,3h1v1h-1zM11,3h1v1h-1zM15,3h1v1h-1zM16,3h1v1h-1zM18,3h1v1h-1zM19,3h1v1h-1zM22,3h1v1h-1zM24,3h1v1h-1zM28,3h1v1h-1zM29,3h1v1h-1zM32,3h1v1h-1zM38,3h1v1h-1zM2,4h1v1h-1zM4,4h1v1h-1zM5,4h1v1h-1zM6,4h1v1h-1zM8,4h1v1h-1zM10,4h1v1h-1zM14,4h1v1h-1zM22,4h1v1h-1zM23,4h1v1h-1zM24,4h1v1h-1zM25,4h1v1h-1zM29,4h1v1h-1zM32,4h1v1h-1zM34,4h1v1h-1zM35,4h1v1h-1zM36,4h1v1h-1zM38,4h1v1h-1zM2,5h1v1h-1zM4,5h1v1h-1zM5,5h1v1h-1zM6,5h1v1h-1zM8,5h1v1h-1zM10,5h1v1h-1zM11,5h1v1h-1zM14,5h1v1h-1zM18,5h1v1h-1zM19,5h1v1h-1zM21,5h1v1h-1zM24,5h1v1h-1zM25,5h1v1h-1zM26,5h1v1h-1zM27,5h1v1h-1zM28,5h1v1h-1zM29,5h1v1h-1zM30,5h1v1h-1zM32,5h1v1h-1zM34,5h1v1h-1zM35,5h1v1h-1zM36,5h1v1h-1zM38,5h1v1h-1zM2,6h1v1h-1zM4,6h1v1h-1zM5,6h1v1h-1zM6,6h1v1h-1zM8,6h1v1h-1zM10,6h1v1h-1zM11,6h1v1h-1zM16,6h1v1h-1zM17,6h1v1h-1zM20,6h1v1h-1zM21,6h1v1h-1zM25,6h1v1h-1zM30,6h1v1h-1zM32,6h1v1h-1zM34,6h1v1h-1zM35,6h1v1h-1zM36,6h1v1h-1zM38,6h1v1h-1zM2,7h1v1h-1zM8,7h1v1h-1zM10,7h1v1h-1zM12,7h1v1h-1zM14,7h1v1h-1zM20,7h1v1h-1zM22,7h1v1h-1zM23,7h1v1h-1zM24,7h1v1h-1zM29,7h1v1h-1zM32,7h1v1h-1zM38,7h1v1h-1zM2,8h1v1h-1zM3,8h1v1h-1zM4,8h1v1h-1zM5,8h1v1h-1zM6,8h1v1h-1zM7,8h1v1h-1zM8,8h1v1h-1zM10,8h1v1h-1zM12,8h1v1h-1zM14,8h1v1h-1zM16,8h1v1h-1zM18,8h1v1h-1zM20,8h1v1h-1zM22,8h1v1h-1zM24,8h1v1h-1zM26,8h1v1h-1zM28,8h1v1h-1zM30,8h1v1h-1zM32,8h1v1h-1zM33,8h1v1h-1zM34,8h1v1h-1zM35,8h1v1h-1zM36,8h1v1h-1zM37,8h1v1h-1zM38,8h1v1h-1zM10,9h1v1h-1zM11,9h1v1h-1zM12,9h1v1h-1zM13,9h1v1h-1zM15,9h1v1h-1zM16,9h1v1h-1zM17,9h1v1h-1zM23,9h1v1h-1zM24,9h1v1h-1zM25,9h1v1h-1zM26,9h1v1h-1zM28,9h1v1h-1zM2,10h1v1h-1zM4,10h1v1h-1zM5,10h1v1h-1zM6,10h1v1h-1zM7,10h1v1h-1zM8,10h1v1h-1zM15,10h1v1h-1zM16,10h1v1h-1zM17,10h1v1h-1zM19,10h1v1h-1zM22,10h1v1h-1zM27,10h1v1h-1zM29,10h1v1h-1zM30,10h1v1h-1zM32,10h1v1h-1zM33,10h1v1h-1zM34,10h1v1h-1zM35,10h1v1h-1zM36,10h1v1h-1zM2,11h1v1h-1zM3,11h1v1h-1zM4,11h1v1h-1zM7,11h1v1h-1zM9,11h1v1h-1zM11,11h1v1h-1zM13,11h1v1h-1zM16,11h1v1h-1zM17,11h1v1h-1zM18,11h1v1h-1zM20,11h1v1h-1zM21,11h1v1h-1zM24,11h1v1h-1zM25,11h1v1h-1zM26,11h1v1h-1zM28,11h1v1h-1zM31,11h1v1h-1zM37,11h1v1h-1zM3,12h1v1h-1zM4,12h1v1h-1zM5,12h1v1h-1zM8,12h1v1h-1zM11,12h1v1h-1zM15,12h1v1h-1zM16,12h1v1h-1zM20,12h1v1h-1zM23,12h1v1h-1zM24,12h1v1h-1zM26,12h1v1h-1zM27,12h1v1h-1zM28,12h1v1h-1zM29,12h1v1h-1zM32,12h1v1h-1zM34,12h1v1h-1zM35,12h1v1h-1zM37,12h1v1h-1zM38,12h1v1h-1zM2,13h1v1h-1zM4,13h1v1h-1zM5,13h1v1h-1zM7,13h1v1h-1zM11,13h1v1h-1zM14,13h1v1h-1zM16,13h1v1h-1zM18,13h1v1h-1zM21,13h1v1h-1zM23,13h1v1h-1zM24,13h1v1h-1zM25,13h1v1h-1zM26,13h1v1h-1zM29,13h1v1h-1zM31,13h1v1h-1zM32,13h1v1h-1zM35,13h1v1h-1zM38,13h1v1h-1zM4,14h1v1h-1zM5,14h1v1h-1zM8,14h1v1h-1zM11,14h1v1h-1zM13,14h1v1h-1zM14,14h1v1h-1zM15,14h1v1h-1zM19,14h1v1h-1zM22,14h1v1h-1zM26,14h1v1h-1zM27,14h1v1h-1zM28,14h1v1h-1zM29,14h1v1h-1zM30,14h1v1h-1zM31,14h1v1h-1zM32,14h1v1h-1zM34,14h1v1h-1zM36,14h1v1h-1zM37,14h1v1h-1zM38,14h1v1h-1zM3,15h1v1h-1zM5,15h1v1h-1zM6,15h1v1h-1zM7,15h1v1h-1zM9,15h1v1h-1zM10,15h1v1h-1zM13,15h1v1h-1zM14,15h1v1h-1zM15,15h1v1h-1zM20,15h1v1h-1zM21,15h1v1h-1zM25,15h1v1h-1zM30,15h1v1h-1zM31,15h1v1h-1zM33,15h1v1h-1zM37,15h1v1h-1zM2,16h1v1h-1zM3,16h1v1h-1zM6,16h1v1h-1zM8,16h1v1h-1zM10,16h1v1h-1zM15,16h1v1h-1zM17,16h1v1h-1zM23,16h1v1h-1zM24,16h1v1h-1zM26,16h1v1h-1zM28,16h1v1h-1zM29,16h1v1h-1zM30,16h1v1h-1zM32,16h1v1h-1zM33,16h1v1h-1zM34,16h1v1h-1zM35,16h1v1h-1zM38,16h1v1h-1zM2,17h1v1h-1zM5,17h1v1h-1zM6,17h1v1h-1zM7,17h1v1h-1zM10,17h1v1h-1zM12,17h1v1h-1zM13,17h1v1h-1zM14,17h1v1h-1zM16,17h1v1h-1zM20,17h1v1h-1zM21,17h1v1h-1zM22,17h1v1h-1zM23,17h1v1h-1zM24,17h1v1h-1zM25,17h1v1h-1zM28,17h1v1h-1zM30,17h1v1h-1zM31,17h1v1h-1zM33,17h1v1h-1zM34,17h1v1h-1zM37,17h1v1h-1zM38,17h1v1h-1zM5,18h1v1h-1zM6,18h1v1h-1zM7,18h1v1h-1zM8,18h1v1h-1zM9,18h1v1h-1zM10,18h1v1h-1zM12,18h1v1h-1zM14,18h1v1h-1zM16,18h1v1h-1zM17,18h1v1h-1zM19,18h1v1h-1zM22,18h1v1h-1zM24,18h1v1h-1zM25,18h1v1h-1zM26,18h1v1h-1zM27,18h1v1h-1zM30,18h1v1h-1zM31,18h1v1h-1zM32,18h1v1h-1zM34,18h1v1h-1zM36,18h1v1h-1zM37,18h1v1h-1zM38,18h1v1h-1zM2,19h1v1h-1zM3,19h1v1h-1zM5,19h1v1h-1zM9,19h1v1h-1zM13,19h1v1h-1zM14,19h1v1h-1zM16,19h1v1h-1zM17,19h1v1h-1zM21,19h1v1h-1zM22,19h1v1h-1zM25,19h1v1h-1zM27,19h1v1h-1zM28,19h1v1h-1zM33,19h1v1h-1zM35,19h1v1h-1zM37,19h1v1h-1zM3,20h1v1h-1zM4,20h1v1h-1zM5,20h1v1h-1zM6,20h1v1h-1zM8,20h1v1h-1zM10,20h1v1h-1zM11,20h1v1h-1zM12,20h1v1h-1zM13,20h1v1h-1zM14,20h1v1h-1zM15,20h1v1h-1zM17,20h1v1h-1zM24,20h1v1h-1zM26,20h1v1h-1zM27,20h1v1h-1zM28,20h1v1h-1zM29,20h1v1h-1zM30,20h1v1h-1zM32,20h1v1h-1zM33,20h1v1h-1zM37,20h1v1h-1zM38,20h1v1h-1zM4,21h1v1h-1zM6,21h1v1h-1zM7,21h1v1h-1zM15,21h1v1h-1zM20,21h1v1h-1zM21,21h1v1h-1zM22,21h1v1h-1zM23,21h1v1h-1zM24,21h1v1h-1zM28,21h1v1h-1zM32,21h1v1h-1zM35,21h1v1h-1zM38,21h1v1h-1zM2,22h1v1h-1zM3,22h1v1h-1zM4,22h1v1h-1zM5,22h1v1h-1zM6,22h1v1h-1zM8,22h1v1h-1zM11,22h1v1h-1zM12,22h1v1h-1zM14,22h1v1h-1zM16,22h1v1h-1zM17,22h1v1h-1zM18,22h1v1h-1zM19,22h1v1h-1zM22,22h1v1h-1zM24,22h1v1h-1zM26,22h1v1h-1zM27,22h1v1h-1zM28,22h1v1h-1zM29,22h1v1h-1zM31,22h1v1h-1zM32,22h1v1h-1zM34,22h1v1h-1zM36,22h1v1h-1zM3,23h1v1h-1zM4,23h1v1h-1zM9,23h1v1h-1zM10,23h1v1h-1zM11,23h1v1h-1zM12,23h1v1h-1zM16,23h1v1h-1zM18,23h1v1h-1zM21,23h1v1h-1zM22,23h1v1h-1zM25,23h1v1h-1zM26,23h1v1h-1zM28,23h1v1h-1zM30,23h1v1h-1zM35,23h1v1h-1zM3,24h1v1h-1zM5,24h1v1h-1zM8,24h1v1h-1zM10,24h1v1h-1zM11,24h1v1h-1zM13,24h1v1h-1zM14,24h1v1h-1zM15,24h1v1h-1zM16,24h1v1h-1zM17,24h1v1h-1zM18,24h1v1h-1zM19,24h1v1h-1zM22,24h1v1h-1zM23,24h1v1h-1zM24,24h1v1h-1zM27,24h1v1h-1zM29,24h1v1h-1zM32,24h1v1h-1zM33,24h1v1h-1zM34,24h1v1h-1zM35,24h1v1h-1zM37,24h1v1h-1zM38,24h1v1h-1zM3,25h1v1h-1zM5,25h1v1h-1zM7,25h1v1h-1zM9,25h1v1h-1zM12,25h1v1h-1zM14,25h1v1h-1zM17,25h1v1h-1zM18,25h1v1h-1zM20,25h1v1h-1zM21,25h1v1h-1zM22,25h1v1h-1zM23,25h1v1h-1zM25,25h1v1h-1zM26,25h1v1h-1zM28,25h1v1h-1zM29,25h1v1h-1zM33,25h1v1h-1zM34,25h1v1h-1zM37,25h1v1h-1zM38,25h1v1h-1zM3,26h1v1h-1zM8,26h1v1h-1zM9,26h1v1h-1zM12,26h1v1h-1zM14,26h1v1h-1zM16,26h1v1h-1zM17,26h1v1h-1zM18,26h1v1h-1zM19,26h1v1h-1zM21,26h1v1h-1zM24,26h1v1h-1zM26,26h1v1h-1zM27,26h1v1h-1zM29,26h1v1h-1zM32,26h1v1h-1zM34,26h1v1h-1zM36,26h1v1h-1zM37,26h1v1h-1zM38,26h1v1h-1zM2,27h1v1h-1zM3,27h1v1h-1zM6,27h1v1h-1zM7,27h1v1h-1zM10,27h1v1h-1zM11,27h1v1h-1zM13,27h1v1h-1zM18,27h1v1h-1zM20,27h1v1h-1zM21,27h1v1h-1zM23,27h1v1h-1zM25,27h1v1h-1zM28,27h1v1h-1zM30,27h1v1h-1zM31,27h1v1h-1zM33,27h1v1h-1zM2,28h1v1h-1zM4,28h1v1h-1zM6,28h1v1h-1zM8,28h1v1h-1zM12,28h1v1h-1zM14,28h1v1h-1zM15,28h1v1h-1zM17,28h1v1h-1zM18,28h1v1h-1zM19,28h1v1h-1zM22,28h1v1h-1zM23,28h1v1h-1zM26,28h1v1h-1zM29,28h1v1h-1zM37,28h1v1h-1zM38,28h1v1h-1zM2,29h1v1h-1zM7,29h1v1h-1zM9,29h1v1h-1zM12,29h1v1h-1zM14,29h1v1h-1zM15,29h1v1h-1zM16,29h1v1h-1zM17,29h1v1h-1zM18,29h1v1h-1zM20,29h1v1h-1zM21,29h1v1h-1zM23,29h1v1h-1zM24,29h1v1h-1zM31,29h1v1h-1zM32,29h1v1h-1zM33,29h1v1h-1zM35,29h1v1h-1zM37,29h1v1h-1zM2,30h1v1h-1zM4,30h1v1h-1zM5,30h1v1h-1zM6,30h1v1h-1zM7,30h1v1h-1zM8,30h1v1h-1zM9,30h1v1h-1zM13,30h1v1h-1zM14,30h1v1h-1zM15,30h1v1h-1zM16,30h1v1h-1zM17,30h1v1h-1zM19,30h1v1h-1zM21,30h1v1h-1zM24,30h1v1h-1zM27,30h1v1h-1zM28,30h1v1h-1zM29,30h1v1h-1zM30,30h1v1h-1zM31,30h1v1h-1zM32,30h1v1h-1zM33,30h1v1h-1zM34,30h1v1h-1zM36,30h1v1h-1zM38,30h1v1h-1zM10,31h1v1h-1zM12,31h1v1h-1zM14,31h1v1h-1zM18,31h1v1h-1zM19,31h1v1h-1zM20,31h1v1h-1zM21,31h1v1h-1zM24,31h1v1h-1zM25,31h1v1h-1zM30,31h1v1h-1zM34,31h1v1h-1zM35,31h1v1h-1zM37,31h1v1h-1zM2,32h1v1h-1zM3,32h1v1h-1zM4,32h1v1h-1zM5,32h1v1h-1zM6,32h1v1h-1zM7,32h1v1h-1zM8,32h1v1h-1zM17,32h1v1h-1zM18,32h1v1h-1zM20,32h1v1h-1zM22,32h1v1h-1zM23,32h1v1h-1zM27,32h1v1h-1zM30,32h1v1h-1zM32,32h1v1h-1zM34,32h1v1h-1zM36,32h1v1h-1zM38,32h1v1h-1zM2,33h1v1h-1zM8,33h1v1h-1zM10,33h1v1h-1zM11,33h1v1h-1zM14,33h1v1h-1zM15,33h1v1h-1zM23,33h1v1h-1zM24,33h1v1h-1zM28,33h1v1h-1zM30,33h1v1h-1zM34,33h1v1h-1zM35,33h1v1h-1zM37,33h1v1h-1zM2,34h1v1h-1zM4,34h1v1h-1zM5,34h1v1h-1zM6,34h1v1h-1zM8,34h1v1h-1zM10,34h1v1h-1zM12,34h1v1h-1zM14,34h1v1h-1zM16,34h1v1h-1zM17,34h1v1h-1zM19,34h1v1h-1zM21,34h1v1h-1zM24,34h1v1h-1zM27,34h1v1h-1zM29,34h1v1h-1zM30,34h1v1h-1zM31,34h1v1h-1zM32,34h1v1h-1zM33,34h1v1h-1zM34,34h1v1h-1zM36,34h1v1h-1zM37,34h1v1h-1zM2,35h1v1h-1zM4,35h1v1h-1zM5,35h1v1h-1zM6,35h1v1h-1zM8,35h1v1h-1zM10,35h1v1h-1zM11,35h1v1h-1zM12,35h1v1h-1zM15,35h1v1h-1zM16,35h1v1h-1zM18,35h1v1h-1zM19,35h1v1h-1zM21,35h1v1h-1zM22,35h1v1h-1zM23,35h1v1h-1zM25,35h1v1h-1zM26,35h1v1h-1zM27,35h1v1h-1zM28,35h1v1h-1zM29,35h1v1h-1zM30,35h1v1h-1zM32,35h1v1h-1zM34,35h1v1h-1zM37,35h1v1h-1zM38,35h1v1h-1zM2,36h1v1h-1zM4,36h1v1h-1zM5,36h1v1h-1zM6,36h1v1h-1zM8,36h1v1h-1zM10,36h1v1h-1zM12,36h1v1h-1zM16,36h1v1h-1zM17,36h1v1h-1zM18,36h1v1h-1zM20,36h1v1h-1zM23,36h1v1h-1zM28,36h1v1h-1zM30,36h1v1h-1zM35,36h1v1h-1zM36,36h1v1h-1zM37,36h1v1h-1zM38,36h1v1h-1zM2,37h1v1h-1zM8,37h1v1h-1zM11,37h1v1h-1zM14,37h1v1h-1zM15,37h1v1h-1zM21,37h1v1h-1zM22,37h1v1h-1zM23,37h1v1h-1zM26,37h1v1h-1zM29,37h1v1h-1zM30,37h1v1h-1zM32,37h1v1h-1zM34,37h1v1h-1zM35,37h1v1h-1zM38,37h1v1h-1zM2,38h1v1h-1zM3,38h1v1h-1zM4,38h1v1h-1zM5,38h1v1h-1zM6,38h1v1h-1zM7,38h1v1h-1zM8,38h1v1h-1zM10,38h1v1h-1zM12,38h1v1h-1zM13,38h1v1h-1zM15,38h1v1h-1zM17,38h1v1h-1zM18,38h1v1h-1zM19,38h1v1h-1zM21,38h1v1h-1zM24,38h1v1h-1zM25,38h1v1h-1zM27,38h1v1h-1zM28,38h1v1h-1zM31,38h1v1h-1zM32,38h1v1h-1zM34,38h1v1h-1zM36,38h1v1h-1zM37,38h1v1h-1zM38,38h1v1h-1z" fill="#000"/></svg>`;

export function MkEcard({ zh }: { zh: boolean }) {
  return (
    <div className="mk-ecard">
      <div className="mk-ecard-txt">
        <b>{zh ? "想進一步了解或有疑問？" : "Questions or want to know more?"}</b>
        <span>
          {zh
            ? "歡迎查看我的電子名片，可直接 WhatsApp、加 IG 或儲存聯絡資料。"
            : "See my e-card to WhatsApp me, follow on IG or save my contact."}
        </span>
      </div>
      <a className="mk-ecard-btn" href={ECARD_URL} target="_blank" rel="noopener">
        {zh ? "查看電子名片" : "View e-card"} <span aria-hidden="true">→</span>
      </a>
      <div className="mk-ecard-qr" dangerouslySetInnerHTML={{ __html: ECARD_QR }} />
    </div>
  );
}

function today() {
  const d = new Date();
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function MkPrintHead() {
  return (
    <div className="mk-print-head">
      <b>MKPA · 積金羅盤</b>
      <span suppressHydrationWarning>列印日期：{today()}</span>
    </div>
  );
}

/* ===== 分享呢個方案（對應 _standard/snippets.html 嘅 mkShare / mkToast）===== */

function mkToast(msg: string) {
  const t = document.createElement("div");
  t.className = "mk-toast";
  t.setAttribute("role", "status");
  t.textContent = msg;
  (document.querySelector("dialog[open]") ?? document.body).appendChild(t);
  window.setTimeout(() => t.remove(), 2400);
}

/**
 * 手機彈出分享選單（WhatsApp 等），電腦複製連結。url 要包括客人揀嘅設定，
 * 但唔可以包括客人姓名（呢個工具本身唔收姓名）。
 */
export function mkShare(url?: string) {
  const link = url ?? window.location.href;
  if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
    navigator.share({ title: document.title, url: link }).catch(() => {});
    return;
  }
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(
    () => mkToast("已複製連結，客人撳開會見到同一個方案"),
    () => window.prompt("複製呢條連結：", link),
  );
}

/* 頁頭「分享呢個方案」掣：有個人化設定嘅頁面登記點樣砌連結，頁頭先會顯示個掣。 */
type ShareBuilder = (() => string) | null;
let builder: ShareBuilder = null;
const listeners = new Set<() => void>();

export function useShareLink(build: ShareBuilder) {
  const ref = useRef(build);
  ref.current = build;
  const active = build != null;
  useEffect(() => {
    if (!active) return;
    builder = () => (ref.current ? ref.current() : window.location.href);
    listeners.forEach((l) => l());
    return () => {
      builder = null;
      listeners.forEach((l) => l());
    };
  }, [active]);
}

export function useShareAvailable(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => builder != null,
    () => false,
  );
}

export function shareCurrent() {
  mkShare(builder ? builder() : undefined);
}
