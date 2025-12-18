from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics.charts.barcharts import HorizontalBarChart
import io
import os
import platform

# Register Chinese Font
# Try to find a common Chinese font on Windows/Linux
font_path = None
system = platform.system()
if system == 'Windows':
    # Common Windows fonts
    possible_paths = [
        "C:\\Windows\\Fonts\\simsun.ttc", # Songti
        "C:\\Windows\\Fonts\\msyh.ttc",   # YaHei
        "C:\\Windows\\Fonts\\simhei.ttf", # HeiTi
    ]
    for p in possible_paths:
        if os.path.exists(p):
            font_path = p
            break
elif system == 'Linux':
    # Common Linux fonts (e.g. Ubuntu, Debian)
    possible_paths = [
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
    ]
    for p in possible_paths:
        if os.path.exists(p):
            font_path = p
            break

FONT_NAME = 'SimSun'
if font_path:
    try:
        pdfmetrics.registerFont(TTFont(FONT_NAME, font_path))
    except Exception as e:
        print(f"Failed to register font {font_path}: {e}")
        FONT_NAME = 'Helvetica' # Fallback
else:
    FONT_NAME = 'Helvetica' # Fallback

def create_pdf_report(report_data: dict, session_id: str) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            rightMargin=20*mm, leftMargin=20*mm,
                            topMargin=20*mm, bottomMargin=20*mm)
    
    styles = getSampleStyleSheet()
    # Define custom styles
    title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Title'],
        fontName=FONT_NAME,
        fontSize=28,
        leading=36,
        alignment=1, # Center
        spaceAfter=10,
        textColor=colors.HexColor('#006064'),
        fontName_bold=FONT_NAME
    )
    
    subtitle_style = ParagraphStyle(
        'ReportSubtitle',
        parent=styles['Normal'],
        fontName=FONT_NAME,
        fontSize=12,
        alignment=1,
        textColor=colors.HexColor('#0097a7'),
        spaceAfter=50,
        wordWrap='CJK',
        letterSpacing=2
    )

    h1_style = ParagraphStyle(
        'Heading1Custom',
        parent=styles['Heading1'],
        fontName=FONT_NAME,
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#00695c'),
        spaceBefore=20,
        spaceAfter=10,
        borderPadding=5,
        borderColor=colors.HexColor('#b2ebf2'),
        borderWidth=0,
        borderBottomWidth=1
    )

    normal_style = ParagraphStyle(
        'NormalCustom',
        parent=styles['Normal'],
        fontName=FONT_NAME,
        fontSize=12,
        leading=18,
        textColor=colors.HexColor('#37474f')
    )
    
    small_style = ParagraphStyle(
        'SmallCustom',
        parent=styles['Normal'],
        fontName=FONT_NAME,
        fontSize=10,
        leading=14,
        textColor=colors.grey
    )

    story = []

    # --- Cover Page ---
    # Logo / Icon placeholder (Text for now)
    story.append(Spacer(1, 40*mm))
    story.append(Paragraph("系统架构设计师", title_style))
    story.append(Paragraph("智能测评报告", title_style))
    story.append(Paragraph("SMART ASSESSMENT REPORT", subtitle_style))
    
    story.append(Spacer(1, 10*mm))
    
    # Cover Info Table
    report_info = report_data.get('ai_report', {})
    title = report_info.get('evaluation', {}).get('level') or report_info.get('title') or "软考考生"
    score = report_info.get('score', 0)
    date_str = datetime.now().strftime('%Y-%m-%d')
    
    cover_data = [
        ["测评编号", session_id[:8].upper()],
        ["生成日期", date_str],
        ["考生评级", title],
        ["综合得分", str(score)]
    ]
    
    t = Table(cover_data, colWidths=[60*mm, 80*mm])
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), FONT_NAME),
        ('FONTSIZE', (0,0), (-1,-1), 14),
        ('TEXTCOLOR', (0,0), (0,-1), colors.grey),
        ('TEXTCOLOR', (1,0), (1,-1), colors.black),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 15),
        ('LINEBELOW', (0,0), (-1,-1), 1, colors.HexColor('#e0f7fa')),
    ]))
    story.append(t)
    
    # Remove the inline footer paragraph, we will draw it in the footer callback
    # story.append(Spacer(1, 60*mm))
    # story.append(Paragraph("由@跃界星图-智能测评系统提供", small_style))
    story.append(PageBreak())

    # --- Content Page ---
    
    # 1. Overview
    story.append(Paragraph("测评详情分析", h1_style))
    
    # 3 Metrics
    accuracy = report_info.get('accuracy', 0)
    duration = report_info.get('duration_minutes', 0)
    
    metrics_data = [
        [f"{accuracy}%", f"{duration} 分", title],
        ["正确率", "用时", "评级"]
    ]
    
    t_metrics = Table(metrics_data, colWidths=[50*mm, 50*mm, 50*mm])
    t_metrics.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), FONT_NAME),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTSIZE', (0,0), (-1,0), 20),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#00838f')),
        ('FONTSIZE', (0,1), (-1,1), 12),
        ('TEXTCOLOR', (0,1), (-1,1), colors.grey),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#e0f7fa')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e0f7fa')),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f0fcfd')),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_metrics)
    story.append(Spacer(1, 10*mm))

    # 2. Prediction
    prediction = report_info.get('prediction', "")
    if isinstance(prediction, dict):
        prediction = prediction.get('advice', "")
        
    story.append(Paragraph("真实考试预测", h1_style))
    
    # Styled Prediction Box
    pred_style = ParagraphStyle(
        'PredictionStyle',
        parent=normal_style,
        textColor=colors.HexColor('#00695c'),
        leading=16
    )
    
    pred_table = Table([[Paragraph(str(prediction), pred_style)]], colWidths=[160*mm])
    pred_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#e0f2f1')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#b2dfdb')),
        ('TOPPADDING', (0,0), (-1,-1), 15),
        ('BOTTOMPADDING', (0,0), (-1,-1), 15),
        ('LEFTPADDING', (0,0), (-1,-1), 15),
        ('RIGHTPADDING', (0,0), (-1,-1), 15),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]), # ReportLab 3.6+ supports rounded corners? If not, ignored.
    ]))
    story.append(pred_table)
    story.append(Spacer(1, 10*mm))

    # 3. Knowledge Points (Simple Bar Chart simulation using Table)
    story.append(Paragraph("知识点掌握情况", h1_style))
    
    radar_data = report_info.get('radar_data', [])
    if radar_data:
        kp_table_data = []
        for item in radar_data:
            subject = item.get('subject', 'Unknown')
            score_val = item.get('A', 0)
            
            # Create a drawing for the bar
            d = Drawing(100*mm, 5*mm)
            # Background
            d.add(Rect(0, 0, 100*mm, 5*mm, fillColor=colors.HexColor('#f5f5f5'), strokeColor=None))
            # Foreground
            bar_width = (score_val / 100.0) * 100 * mm
            d.add(Rect(0, 0, bar_width, 5*mm, fillColor=colors.HexColor('#00acc1'), strokeColor=None))
            
            kp_table_data.append([subject, d, f"{score_val}%"])

        t_kp = Table(kp_table_data, colWidths=[65*mm, 90*mm, 15*mm])
        t_kp.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,-1), FONT_NAME),
            ('FONTSIZE', (0,0), (-1,-1), 10),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TEXTCOLOR', (0,0), (0,-1), colors.HexColor('#37474f')),
            ('TEXTCOLOR', (-1,0), (-1,-1), colors.HexColor('#00838f')),
            ('ALIGN', (-1,0), (-1,-1), 'RIGHT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(t_kp)
    
    story.append(Spacer(1, 10*mm))

    # 4. Strong & Weak Points (2-Column Layout)
    strong = report_info.get('knowledge_profile', {}).get('strengths') or report_info.get('strong_points', [])
    weak = report_info.get('knowledge_profile', {}).get('weaknesses') or report_info.get('weak_points', [])
    
    # Create content for columns
    # Removed separate content lists as we now add directly to story
    # strong_content = [] ...
    # weak_content = [] ...

    # Layout Table
    # Fix: Wrap table content in KeepInFrame or simplify structure to avoid LayoutError
    # The error "Flowable ... too large on page" happens when content exceeds page height
    # We should split strong/weak points if they are too long, but here we can just add them sequentially
    # instead of a side-by-side table which is hard to break across pages.
    # Let's switch to sequential layout for safety.
    
    story.append(Paragraph("优势领域", h1_style))
    if strong:
        for s in strong:
            story.append(Paragraph(f"• {s}", normal_style))
            story.append(Spacer(1, 2*mm))
    else:
        story.append(Paragraph("暂无明显优势", normal_style))
        
    story.append(Spacer(1, 5*mm))
    
    story.append(Paragraph("薄弱环节", h1_style))
    if weak:
        for w in weak:
            story.append(Paragraph(f"• {w}", normal_style))
            story.append(Spacer(1, 2*mm))
    else:
        story.append(Paragraph("无明显短板", normal_style))

    story.append(Spacer(1, 10*mm))

    # 5. Learning Path
    story.append(Paragraph("推荐学习路径", h1_style))
    learning_path = report_info.get('learning_path', [])
    if learning_path:
        path_data = []
        for i, step in enumerate(learning_path):
            import re
            cleaned_step = re.sub(r'^\d+[\.、]\s*', '', str(step))
            
            # Badge for number
            badge_d = Drawing(10*mm, 10*mm)
            badge_d.add(Rect(0, 0, 8*mm, 8*mm, rx=2*mm, ry=2*mm, fillColor=colors.HexColor('#e0f7fa'), strokeColor=None))
            # Center text in badge (approximate)
            badge_d.add(String(4*mm, 2.5*mm, str(i+1), fontName=FONT_NAME, fontSize=10, fillColor=colors.HexColor('#006064'), textAnchor='middle'))
            
            path_data.append([badge_d, Paragraph(cleaned_step, normal_style)])
            
        path_table = Table(path_data, colWidths=[15*mm, 150*mm])
        path_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ]))
        story.append(path_table)

    # --- Cover Page ---
    # Draw decorative graphics directly on canvas
    def draw_cover_decorations(canvas, doc):
        canvas.saveState()
        # Top right circle
        canvas.setFillColor(colors.HexColor('#e0f7fa'))
        # Use transparent color object instead of None for stroke
        canvas.setStrokeColor(colors.Color(0,0,0,alpha=0))
        canvas.circle(210*mm, 297*mm, 80*mm, fill=1, stroke=0)
        
        # Bottom left circle
        canvas.setFillColor(colors.HexColor('#e0f2f1'))
        canvas.circle(0, 0, 100*mm, fill=1, stroke=0)
        
        # Accent line
        canvas.setStrokeColor(colors.HexColor('#00acc1'))
        canvas.setLineWidth(2)
        canvas.line(30*mm, 250*mm, 180*mm, 250*mm)
        
        # Bottom Footer (Centered)
        canvas.setFont(FONT_NAME, 10)
        canvas.setFillColor(colors.grey)
        footer_text = "@长沙跃界星图数字科技有限公司-智能测评系统提供"
        text_width = canvas.stringWidth(footer_text, FONT_NAME, 10)
        # Page width is A4[0] (approx 210mm), we want center
        page_width = 210*mm
        x_pos = (page_width - text_width) / 2
        y_pos = 15*mm # Bottom margin area
        canvas.drawString(x_pos, y_pos, footer_text)
        
        canvas.restoreState()

    doc.build(story, onFirstPage=draw_cover_decorations)
    return buffer.getvalue()

from datetime import datetime
