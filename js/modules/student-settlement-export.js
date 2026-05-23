// === v9.8-stable-recovery-final12 student tuition notice Excel export ===
(function () {
  const COLORS = { green: "92D050", title: "EAF4FF", border: "000000" };

  function dbClientV986(){ if(typeof db !== "undefined" && db?.from) return db; if(typeof supabase !== "undefined" && supabase?.from) return supabase; if(window.db?.from) return window.db; if(window.supabase?.from) return window.supabase; return null; }
  async function fetchDbSummaryV989(studentId, ym){
    const client = dbClientV986();
    if(!client?.rpc || !studentId || !ym) return null;
    const { data, error } = await client.rpc("school_get_student_monthly_settlement_summary", { p_student_id: studentId, p_year_month: ym });
    if(error){ console.warn("export settlement summary rpc failed", error); return null; }
    return Array.isArray(data) ? data[0] : data;
  }
  function n(v){ const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }
  function round(v){ return Math.round(n(v)); }
  function safeFileName(v){ return String(v || "").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0,80) || "settlement"; }
  function currentMonth(){ return document.getElementById("settlementMonthFilter")?.value || new Date().toISOString().slice(0,7); }
  function currentStudentId(){ return document.getElementById("settlementStudentFilter")?.value || ""; }
  function nextMonth(ym){ const [y,m]=String(ym).split("-").map(Number); const d=new Date(y,m,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
  function prevMonth(ym){ const [y,m]=String(ym).split("-").map(Number); const d=new Date(y,m-2,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
  async function fetchPrevCarryover(studentId, ym, student){
    const client = dbClientV986(); if(!studentId || !ym || !client?.from) return n(student.previous_balance_cny);
    const { data, error } = await client.from("school_student_settlement_carryovers")
      .select("amount_cny,status,updated_at")
      .eq("student_id", studentId)
      .eq("to_year_month", ym)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1);
    if(error) { console.warn("export carryover load failed", error); return n(student.previous_balance_cny); }
    const row = data?.[0];
    return row ? n(row.amount_cny) : n(student.previous_balance_cny);
  }
  function monthLabel(ym){ return `${Number(String(ym).split("-")[1] || 0)}月`; }
  function studentName(s){ return s?.display_name || s?.name || ""; }
  function formatDate(v){ if(!v) return ""; const d=String(v).slice(0,10); const dt=new Date(`${d}T00:00:00`); return Number.isNaN(dt.getTime()) ? d : `${dt.getMonth()+1}/${dt.getDate()}/${dt.getFullYear()}`; }
  function formatWeek(v){ if(!v) return ""; const d=String(v).slice(0,10); const dt=new Date(`${d}T00:00:00`); if(Number.isNaN(dt.getTime())) return ""; const ws=new Date(dt); ws.setDate(dt.getDate()-dt.getDay()+1); return `${dt.getMonth()+1}.${ws.getDate()}周`; }
  function feeOfLesson(x){ return n(x?.lesson_fee || n(x?.unit_price) * n(x?.duration_hours)); }
  function subjectName(x){ return x?.subject?.name || x?.subject_name || ""; }
  function lessonContent(x){ return x?.lesson_content || x?.note || subjectName(x); }
  function lessonRoundLabel(x){ return x?.lesson_round || x?.round_label || x?.lesson_no || ""; }
  function timeRange(x){ return [x?.start_time, x?.end_time].filter(Boolean).join("-"); }
  function statusLabel(v){ return ({completed:"已上",makeup:"补课",planned:"预定",cancelled:"取消"})[v] || v || ""; }

  function border(){ return {top:{style:"thin",color:{argb:COLORS.border}},left:{style:"thin",color:{argb:COLORS.border}},bottom:{style:"thin",color:{argb:COLORS.border}},right:{style:"thin",color:{argb:COLORS.border}}}; }
  function fill(color){ return {type:"pattern",pattern:"solid",fgColor:{argb:color}}; }
  function styleCell(cell, opt={}){ cell.border=border(); cell.font={name:"Microsoft YaHei",size:opt.size||10,bold:!!opt.bold}; cell.alignment={vertical:opt.vertical||"middle",horizontal:opt.align||"center",wrapText:opt.wrap!==false}; if(opt.fill) cell.fill=fill(opt.fill); }
  function styleRange(ws, range, opt={}){ const [a,b]=range.split(":"); const s=ws.getCell(a), e=ws.getCell(b); for(let r=s.row;r<=e.row;r++) for(let c=s.col;c<=e.col;c++) styleCell(ws.getCell(r,c), opt); }
  function merge(ws, range, value, opt={}){ ws.mergeCells(range); const cell=ws.getCell(range.split(":")[0]); cell.value=value; styleRange(ws,range,opt); }

  function getLessons(studentId, ym){ return (state.lessonRecords||[]).filter(x => x.student_id===studentId && x.year_month===ym && x.is_billable !== false); }
  function sortRows(rows){ return rows.slice().sort((a,b)=>subjectName(a).localeCompare(subjectName(b),"zh-Hans-CN") || String(a.lesson_date||"").localeCompare(String(b.lesson_date||"")) || String(a.start_time||"").localeCompare(String(b.start_time||""))); }
  function sumHours(rows){ return rows.reduce((s,x)=>s+n(x.duration_hours),0); }
  function sumFee(rows){ return rows.reduce((s,x)=>s+feeOfLesson(x),0); }
  function income(studentId, ym){ const rows=(state.incomeRecords||[]).filter(x=>x.student_id===studentId && x.year_month===ym && x.income_category==="tuition" && x.status==="received"); return {cny:rows.filter(x=>x.currency==="CNY").reduce((s,x)=>s+n(x.amount),0), jpy:rows.filter(x=>x.currency==="JPY").reduce((s,x)=>s+n(x.amount),0)}; }
  function paired(planned, actual){ const max=Math.max(planned.length, actual.length); return Array.from({length:max},(_,i)=>({p:planned[i]||null,a:actual[i]||null})); }

  function data(prevOverride = null){
    const ym=currentMonth(), nextYm=nextMonth(ym), studentId=currentStudentId();
    const student=(state.students||[]).find(x=>x.id===studentId);
    if(!student) return null;
    const rate=n(student.preset_exchange_rate), prev=(prevOverride === null ? n(student.previous_balance_cny) : n(prevOverride));
    const cur=getLessons(studentId,ym);
    const planned=sortRows(cur.filter(x=>x.lesson_type==="planned"));
    const actual=sortRows(cur.filter(x=>x.lesson_type==="actual" && x.status!=="cancelled" && x.status!=="holiday"));
    const nextPlanned=sortRows(getLessons(studentId,nextYm).filter(x=>x.lesson_type==="planned"));
    const inc=income(studentId,ym);
    const plannedJpy=sumFee(planned), actualJpy=sumFee(actual), plannedCny=plannedJpy*rate, actualCny=actualJpy*rate;
    const receivedCny=inc.cny + inc.jpy*rate;
    const diffCny=actualCny-plannedCny;
    const needCny=actualCny-receivedCny-prev;
    const nextJpy=sumFee(nextPlanned), nextCny=nextJpy*rate;
    return {ym,nextYm,student,rate,prev,inc,planned,actual,nextPlanned,plannedJpy,actualJpy,plannedCny,actualCny,diffCny,needCny,nextJpy,nextCny,nextTotalCny:nextCny+needCny,plannedHours:sumHours(planned),actualHours:sumHours(actual),nextHours:sumHours(nextPlanned)};
  }

  function setupCurrent(ws,d){
    ws.columns=[{width:10},{width:12},{width:11},{width:22},{width:9},{width:13},{width:13},{width:9},{width:28},{width:8}];
    merge(ws,"A1:E1",`${d.ym}/1`,{fill:COLORS.green,bold:true}); merge(ws,"F1:J1",`${d.ym}/1`,{fill:COLORS.green,bold:true});
    merge(ws,"A2:E2","预定课时",{fill:COLORS.green,bold:true}); merge(ws,"F2:J2","实际课时",{fill:COLORS.green,bold:true});
    ws.getRow(3).values=["科目","日期","回数","内容","时长（H）","上课日期","时间","时长（H）","内容","状态"];
    styleRange(ws,"A3:J3",{fill:COLORS.green,bold:true});
    const rows=paired(d.planned,d.actual), start=4;
    rows.forEach((pair,i)=>{
      const r=start+i, p=pair.p, a=pair.a;
      ws.getCell(r,1).value=p?subjectName(p):""; ws.getCell(r,2).value=p?(formatWeek(p.lesson_date)||formatDate(p.lesson_date)):""; ws.getCell(r,3).value=p?lessonRoundLabel(p):""; ws.getCell(r,4).value=p?lessonContent(p):""; ws.getCell(r,5).value=p?n(p.duration_hours):"";
      ws.getCell(r,6).value=a?formatDate(a.lesson_date):""; ws.getCell(r,7).value=a?timeRange(a):""; ws.getCell(r,8).value=a?n(a.duration_hours):""; ws.getCell(r,9).value=a?lessonContent(a):""; ws.getCell(r,10).value=a?statusLabel(a.status):"";
      for(let c=1;c<=10;c++) styleCell(ws.getCell(r,c),{fill:COLORS.green,align:(c===4||c===9)?"left":"center",vertical:(c===4||c===9)?"top":"middle"});
      ws.getRow(r).height=26;
    });
    const total=start+Math.max(rows.length,1);
    styleRange(ws,`A${total}:J${total}`,{fill:COLORS.green,bold:true});
    ws.getCell(`E${total}`).value=d.plannedHours; ws.getCell(`H${total}`).value=d.actualHours;
    const s=total+2;
    merge(ws,`A${s}:B${s+7}`,"本月小计",{fill:COLORS.green,bold:true});
    [
      [`上月结余/补交（人民币）`,round(d.prev)],
      [`${monthLabel(d.ym)}课时费应收（日元）`,round(d.plannedJpy)],
      [`${monthLabel(d.ym)}课时费应收（人民币）`,round(d.plannedCny)],
      [`${monthLabel(d.ym)}已收/预支（人民币）`,round(d.inc.cny)],
      [`${monthLabel(d.ym)}应收合计`,round(d.plannedCny-d.prev-d.inc.cny)],
      [`${monthLabel(d.ym)}课时费实际（日元）`,round(d.actualJpy)],
      [`${monthLabel(d.ym)}课时费实际（人民币）`,round(d.actualCny)],
      [`${monthLabel(d.ym)}课时费结算差额`,round(d.diffCny)]
    ].forEach((x,i)=>{ const r=s+i; ws.getCell(r,3).value=x[0]; ws.getCell(r,4).value=x[1]; styleCell(ws.getCell(r,3),{fill:COLORS.green,align:"left",bold:i===7}); styleCell(ws.getCell(r,4),{fill:COLORS.green,align:"right",bold:i===7}); });
    ws.pageSetup={paperSize:9,orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:1,margins:{left:.25,right:.25,top:.35,bottom:.35,header:.2,footer:.2}};
  }

  function setupNext(ws,d){
    ws.columns=[{width:12},{width:12},{width:12},{width:22},{width:9},{width:20}];
    merge(ws,"A1:F1",`${d.nextYm}/1`,{bold:true}); merge(ws,"A2:F2","预定课时",{bold:true});
    ws.getRow(3).values=["科目","日期","回数","内容","时长（H）","备注"]; styleRange(ws,"A3:F3",{bold:true});
    d.nextPlanned.forEach((x,i)=>{ const r=4+i; ws.getCell(r,1).value=subjectName(x); ws.getCell(r,2).value=formatWeek(x.lesson_date)||formatDate(x.lesson_date); ws.getCell(r,3).value=lessonRoundLabel(x); ws.getCell(r,4).value=lessonContent(x); ws.getCell(r,5).value=n(x.duration_hours); ws.getCell(r,6).value=""; for(let c=1;c<=6;c++) styleCell(ws.getCell(r,c),{align:(c===4||c===6)?"left":"center",vertical:(c===4||c===6)?"top":"middle"}); ws.getRow(r).height=26; });
    const total=4+Math.max(d.nextPlanned.length,1); styleRange(ws,`A${total}:F${total}`,{bold:true}); ws.getCell(`E${total}`).value=d.nextHours;
    const s=total+2; merge(ws,`A${s}:B${s+3}`,"本月小计",{bold:true});
    [[`上月结余 ${monthLabel(d.ym)}课时费结算差额（人民币）`,round(d.needCny)],[`${monthLabel(d.nextYm)}课时费应收（日元）`,round(d.nextJpy)],[`${monthLabel(d.nextYm)}课时费应收（人民币）`,round(d.nextCny)],[`${monthLabel(d.nextYm)}应收合计`,round(d.nextTotalCny)]].forEach((x,i)=>{ const r=s+i; ws.getCell(r,3).value=x[0]; ws.getCell(r,4).value=x[1]; styleCell(ws.getCell(r,3),{align:"left",bold:i===3}); styleCell(ws.getCell(r,4),{align:"right",bold:i===3}); });
    ws.pageSetup={paperSize:9,orientation:"portrait",fitToPage:true,fitToWidth:1,fitToHeight:1,margins:{left:.3,right:.3,top:.35,bottom:.35,header:.2,footer:.2}};
  }

  async function exportExcel(){
    if(!window.ExcelJS){ showMessage("Excel 导出库还没有加载完成，请稍后重试。","error"); return; }
    let d=data(); if(!d){ showMessage("请先选择学生和月份。","error"); return; }
    const dbSummary = await fetchDbSummaryV989(currentStudentId(), currentMonth());
    if(dbSummary){
      d.prev = n(dbSummary.carryover_cny);
      d.plannedHours = n(dbSummary.planned_hours);
      d.actualHours = n(dbSummary.actual_hours);
      d.plannedJpy = n(dbSummary.planned_fee_jpy);
      d.plannedCny = n(dbSummary.planned_fee_cny);
      d.actualJpy = n(dbSummary.actual_fee_jpy);
      d.actualCny = n(dbSummary.actual_fee_cny);
      d.needCny = n(dbSummary.locked_carryover_cny ?? dbSummary.final_due_cny);
      d.diffCny = n(dbSummary.locked_carryover_cny ?? dbSummary.final_due_cny);
      d.nextTotalCny = d.nextCny + d.needCny;
    } else {
      const carry = await fetchPrevCarryover(currentStudentId(), currentMonth(), d.student);
      d = data(carry);
    }
    const wb=new ExcelJS.Workbook(); wb.creator="青空进学塾运营管理系统"; wb.created=new Date();
    setupCurrent(wb.addWorksheet(`${monthLabel(d.ym)}课时费小计`),d);
    setupNext(wb.addWorksheet(`${monthLabel(d.nextYm)}预定收费`),d);
    const buffer=await wb.xlsx.writeBuffer(); const blob=new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`${safeFileName(studentName(d.student))}_${d.ym}_课时费通知单.xlsx`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),1000);
    showMessage("学生课时费通知单 Excel 已导出。","ok");
  }

  function bindExportButton(){ const btn=document.getElementById("studentSettlementExportExcelBtn"); if(!btn || btn.dataset.boundSettlementExport==="true") return; btn.dataset.boundSettlementExport="true"; btn.addEventListener("click",exportExcel); }
  const switchPageBeforeV983=typeof switchPage==="function"?switchPage:null; if(switchPageBeforeV983){ window.switchPage=function(page){ switchPageBeforeV983(page); if(page==="student-settlement") setTimeout(bindExportButton,0); }; }
  const renderAllBeforeV983=typeof renderAll==="function"?renderAll:null; if(renderAllBeforeV983){ window.renderAll=function(){ renderAllBeforeV983(); if(document.getElementById("page-student-settlement")?.classList.contains("active")) setTimeout(bindExportButton,0); }; }
  document.addEventListener("DOMContentLoaded",()=>setTimeout(bindExportButton,1000));
  window.SchoolStudentSettlementExportV987={version: "9.8-stable-recovery-final12",exportExcel};
})();
