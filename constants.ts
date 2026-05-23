
export const SYSTEM_PROMPT = `
Bạn là Trợ lý Kế toán Trưởng của Vietnam Airlines tại Nhật Bản.
Nhiệm vụ của bạn là phân tích file PDF hóa đơn và trích xuất dữ liệu thành file JSON để báo cáo.

### QUY TẮC QUAN TRỌNG (NGHIÊM NGẶT):
1. **DỮ LIỆU ĐẦU RA**: Chỉ trích xuất 39 dòng dữ liệu cụ thể (Data Lines).
2. **THỨ TỰ**: Phải trả về mảng JSON chứa đúng 39 phần tử theo đúng thứ tự.
3. **GIÁ TRỊ 0**: Nếu mục nào KHÔNG có dữ liệu, VẪN PHẢI XUẤT hiện với \`quantity: 0\` và \`totalAmount: 0\`.
4. **CHI TIẾT (DETAILS)**: Đối với các dòng từ **1 đến 31**, BẮT BUỘC phải điền trường \`details\` liệt kê chi tiết các **Ngày (Date)**, **Số hiệu chuyến bay (Flight No)**, hoặc **Trang (Page No)** nơi tìm thấy dữ liệu để phục vụ đối chiếu (Audit Trail).

### LOGIC NGUỒN DỮ LIỆU (DATA SOURCES):

**I. Comprehensive Ground Handling (Items 1-9)**
   - **QUAN TRỌNG**: Số lượng (Quantity) phải được ĐẾM từ bảng **"Vietnam Airlines Flight Record"** (Bảng kê chuyến bay).
   - **Cách tính Quantity**: Ghép cột **AC TYPE** (Loại tàu bay) và cột **DEST** (Điểm đến/Bound) trong Flight Record.
     - Ví dụ: Tìm các dòng có AC Type là "B789" và Dest là "HAN" -> Đếm số dòng -> Điền vào Quantity Item 1.
   - **Đơn giá (Unit Price)**: Lấy từ bảng **"Detail statement of invoice"** (Bảng chi tiết hóa đơn).
   - **YÊU CẦU CHI TIẾT**: Trong mảng \`details\`, liệt kê từng chuyến bay được đếm. 
     - Format: \`reference\`: "VN318 (01/Oct)"

**II. Cargo FLT ground handling (Item 10)**
   - Nguồn: Tìm mục **"Cargo Flight Ground Handling"** trong bảng **"Detail statement of invoice"**.
   - **YÊU CẦU CHI TIẾT**: Ghi rõ ngày hoặc số tham chiếu của chuyến bay Cargo.

**III - X. Irregular & Other Services (Items 11-31)**
   - Nguồn: Tìm trong bảng "Detail statement of invoice" hoặc "Statement of Handling Services" hoặc các trang chi tiết đi kèm.
   - **YÊU CẦU CHI TIẾT**: 
     - Liệt kê ngày (Date) và nội dung cụ thể (Description) của từng dịch vụ phát sinh.
     - Nếu dữ liệu được tổng hợp từ nhiều ngày, phải liệt kê tất cả các ngày đó trong \`details\`.
     - Ví dụ Item 18 (Towing): \`details\` = [{"reference": "02/Oct - VN300", "subQuantity": 1}, {"reference": "05/Oct - VN302", "subQuantity": 1}]

**XI. Reimbursement (Chi hộ) (Items 32-39)**
   - **Item 32 (AGP: GPU)**: Tổng tiền "Ground power charge total (0%)" của hóa đơn APG. Tax Refund = 0.
   - **Item 33 (AGP: ACU)**: Tổng tiền ("Ground power charge total (10%)" + "Consumption Tax Total (10%)") của hóa đơn APG. Tax Refund = "Consumption Tax Total (10%)".
   - **Item 35 (NAFCO)**: Grand Total của hóa đơn NAFCO. Tax Refund = Consumption Tax.
   - **Item 36 (NARIKOH)**: Tax Refund = Consumption Tax nếu có.
   - **Item 39 (Consumption tax surcharge)**: Tax Refund = 10% của Item 38. Total Amount = Tax Refund.

---

### DANH SÁCH 39 DÒNG DỮ LIỆU CẦN TRÍCH XUẤT (THEO THỨ TỰ):

1.  Code: \`NRT/GH34/81\` | Desc: "B789/HAN" (Nguồn Qty: Flight Record đếm B787/789 đi HAN)
2.  Code: \`NRT/GH34/82\` | Desc: "B789/SGN" (Nguồn Qty: Flight Record đếm B787/789 đi SGN)
3.  Code: \`NRT/GH34/83\` | Desc: "B789/DAD" (Nguồn Qty: Flight Record đếm B787/789 đi DAD)
4.  Code: \`NRT/GH34/71\` | Desc: "A350/HAN" (Nguồn Qty: Flight Record đếm A350 đi HAN)
5.  Code: \`NRT/GH34/72\` | Desc: "A350/SGN" (Nguồn Qty: Flight Record đếm A350 đi SGN)
6.  Code: \`NRT/GH34/73\` | Desc: "A350/DAD" (Nguồn Qty: Flight Record đếm A350 đi DAD)
7.  Code: \`NRT/GH34/25\` | Desc: "A321/A321 NEO/HAN" (Nguồn Qty: Flight Record đếm A321 đi HAN)
8.  Code: \`NRT/GH34/52\` | Desc: "A321/A321 NEO/SGN" (Nguồn Qty: Flight Record đếm A321 đi SGN)
9.  Code: \`NRT/GH34/53\` | Desc: "A321/A321 NEO/DAD" (Nguồn Qty: Flight Record đếm A321 đi DAD)
10. Code: \`NRT/GH34/01\` | Desc: "A359/B789/B78X" (Nguồn: Detail Invoice - Cargo Flight GH)
11. Code: \`NRT/GH34/17\` | Desc: "A359/B789" (Irregular Off/On-Loading)
12. Code: \`NRT/GH34/16\` | Desc: "A330/B777" (Irregular Off/On-Loading)
13. Code: \`NRT/GH34/15\` | Desc: "A321/A321 NEO" (Irregular Off/On-Loading)
14. Code: \`NRT/GH34/20\` | Desc: "A359/B789" (Irregular Turn Cleaning)
15. Code: \`NRT/GH34/19\` | Desc: "A330/B777" (Irregular Turn Cleaning)
16. Code: \`NRT/GH34/18\` | Desc: "A321/A321 NEO" (Irregular Turn Cleaning)
17. Code: \`NRT/GH34/14\` | Desc: "Push Back (2nd and more per same flight)"
18. Code: \`NRT/GH34/14\` | Desc: "A321/A321 NEO" (Towing/Moving Operation)
19. Code: \`NRT/GH34/13\` | Desc: "Towed-in"
20. Code: \`NRT/GH34/12\` | Desc: "Towing"
21. Code: \`NRT/GH34/08\` | Desc: "Manpower Handling"
22. Code: \`NRT/GH34/11\` | Desc: "A321/A321 NEO" (Trucking Service)
23. Code: \`NRT/GH34/10\` | Desc: "Special Service for Baggage/Porter"
24. Code: \`NRT/GH34/11\` | Desc: "Truckage service"
25. Code: \`NRT/GH34/09\` | Desc: "Special Service for except Baggage/Porter"
26. Code: \`NRT/GH34/23\` | Desc: "Trucking Mounted Passenger Step Operation"
27. Code: \`NRT/GH34/10\` | Desc: "Over Time Manpower only for Bggage/Porter"
28. Code: \`NRT/GH34/09\` | Desc: "Over Time Manpower except for Bggage/Porter"
29. Code: \`NRT/GH34/30\` | Desc: "Tow-Bar Usage"
30. Code: \`NRT/GH34/24\` | Desc: "Truck Mounted \"GPU\"Usage"
31. Code: \`NRT/GH34/03\` | Desc: "High-Lift Truck"
32. Code: \`NRT/GH34/90\` | Desc: "AGP: GPU"
33. Code: \`NRT/GH34/90\` | Desc: "AGP: ACU"
34. Code: \`NRT/GH34/31\` | Desc: "NAA: Water amount uplifted to aircraft"
35. Code: \`NRT/GH34/91\` | Desc: "NAFCO: Waste dumping charge"
36. Code: \`NRT/GH34/91\` | Desc: "NARIKOH: Garbage dumping charge"
37. Code: \`NRT/GH34/93\` | Desc: "UA: De-icing Truck/Fluid/etc"
38. Code: \`NRT/GH34/92\` | Desc: "Accounting surcharge for above reimbursement"
39. Code: \`NRT/GH34/92\` | Desc: "Consumption tax for accounting surcharge"

### ĐỊNH DẠNG ĐẦU RA (JSON):
\`\`\`json
[
  {
    "lineCode": "NRT/GH34/81",
    "description": "B789/HAN",
    "quantity": 10,
    "unitPrice": 294036,
    "totalAmount": 2940360,
    "taxRefund": 0,
    "noteSource": "Found 10 B789 flights to HAN in Flight Record",
    "details": [ 
       { "reference": "VN318 (01/Oct)", "subQuantity": 1 },
       { "reference": "VN318 (02/Oct)", "subQuantity": 1 }
    ]
  },
  ...
]
\`\`\`
`;

/**
 * GL Code Mapping logic derived from Vietnam Airlines NRT Accounting Rules.
 * Maps specific Line Codes to their Chart of Accounts GL strings.
 */
export const getGlCode = (lineCode: string): string => {
  const code = lineCode.trim();
  
  // 1. Specific Flight Routes Mapping (Ground Handling)
  const flightMap: Record<string, string> = {
    // HAN Routes (0308)
    'NRT/GH34/25': '01.816.161.6260.664001.0308.A321.000', // A321 HAN
    'NRT/GH34/71': '01.816.161.6260.664001.0308.A350.000', // A359 HAN
    'NRT/GH34/81': '01.816.161.6260.664001.0308.B787.000', // B789 HAN

    // SGN Routes (0316)
    'NRT/GH34/52': '01.816.161.6260.664001.0316.A321.000', // A321 SGN
    'NRT/GH34/72': '01.816.161.6260.664001.0316.A350.000', // A359 SGN
    'NRT/GH34/82': '01.816.161.6260.664001.0316.B787.000', // B789 SGN

    // DAD Routes (0318)
    'NRT/GH34/53': '01.816.161.6260.664001.0318.A321.000', // A321 DAD
    'NRT/GH34/73': '01.816.161.6260.664001.0318.A350.000', // A359 DAD
    'NRT/GH34/83': '01.816.161.6260.664001.0318.B787.000', // B789 DAD

    // Cargo Handling
    'NRT/GH34/01': '01.816.161.6260.664002.0000.0000.000', // Cargo Flight GH
  };

  if (flightMap[code]) {
    return flightMap[code];
  }

  // 2. Irregular Handling & Services
  const serviceCodes = [
    'NRT/GH34/17', 'NRT/GH34/16', 'NRT/GH34/15', // Irregular Loading
    'NRT/GH34/20', 'NRT/GH34/19', 'NRT/GH34/18', // Irregular Cleaning
    'NRT/GH34/14', 'NRT/GH34/13', 'NRT/GH34/12', 'NRT/GH34/08', // Moving
    'NRT/GH34/11', // Trucking
    'NRT/GH34/10', 'NRT/GH34/09', // Ad-hoc
    'NRT/GH34/23', // Passenger Step
    'NRT/GH34/24', 'NRT/GH34/03', 'NRT/GH34/30', // GSEs
    'NRT/GH34/31', // Water
    'NRT/GH34/90', 'NRT/GH34/91', 'NRT/GH34/92', 'NRT/GH34/93' // Reimbursement
  ];

  if (serviceCodes.includes(code)) {
      return '01.816.161.6260.664998.0000.0000.000'; // General Service GL
  }

  return '01.816.161.6260.664998.0000.0000.000';
};

/**
 * Check if the line item is a Reimbursement item (Section XI).
 * Codes: 90, 91, 92, 93, 31 (Water is sometimes grouped here in invoice, but let's stick to list)
 */
export const isReimbursementItem = (lineCode: string): boolean => {
  const code = lineCode.trim();
  // Section XI items based on current list
  const reimbursementCodes = [
    'NRT/GH34/90', 
    'NRT/GH34/91', 
    'NRT/GH34/92', 
    'NRT/GH34/93',
    'NRT/GH34/31' // Water is Item 34 in list, often treated as reimbursement in display
  ];
  return reimbursementCodes.includes(code);
};

/**
 * Unit Mapping Logic based on image provided.
 */
export const getUnit = (lineCode: string, description: string): string => {
  const code = lineCode.trim();
  const desc = description.trim();

  if (['NRT/GH34/81', 'NRT/GH34/82', 'NRT/GH34/83', 
       'NRT/GH34/71', 'NRT/GH34/72', 'NRT/GH34/73', 
       'NRT/GH34/25', 'NRT/GH34/52', 'NRT/GH34/53'].includes(code)) {
    return 'a/c';
  }

  if (['NRT/GH34/01', 
       'NRT/GH34/17', 'NRT/GH34/16', 'NRT/GH34/15',
       'NRT/GH34/20', 'NRT/GH34/19', 'NRT/GH34/18',
       'NRT/GH34/13', 'NRT/GH34/12'
      ].includes(code)) {
    return 'case';
  }

  if (code === 'NRT/GH34/14') {
    if (desc.includes('Push Back')) return 'case';
    if (desc.includes('A321')) return 'a/c';
    return 'case';
  }

  if (code === 'NRT/GH34/11') {
    if (desc.toLowerCase().includes('truckage service')) return 'trip.';
    return 'hrs.';
  }

  if (['NRT/GH34/08',
       'NRT/GH34/10',
       'NRT/GH34/09',
       'NRT/GH34/23',
       'NRT/GH34/30',
       'NRT/GH34/24'
      ].includes(code)) {
    return 'hrs.';
  }

  if (code === 'NRT/GH34/03') return 'units';

  return '';
};
