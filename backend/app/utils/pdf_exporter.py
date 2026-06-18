import os
import datetime
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Define export directory
EXPORT_DIR = Path(__file__).resolve().parent.parent.parent / "exports"
EXPORT_DIR.mkdir(exist_ok=True)

# Attempt to register Kannada-compatible font (Tunga is default on Windows)
FONT_NAME = "Helvetica"
KAN_FONT_PATH = "C:\\Windows\\Fonts\\tunga.ttf"

if os.path.exists(KAN_FONT_PATH):
    try:
        pdfmetrics.registerFont(TTFont("Tunga", KAN_FONT_PATH))
        FONT_NAME = "Tunga"
        print("Successfully registered Tunga font for Kannada PDF rendering.")
    except Exception as e:
        print(f"Failed to register Tunga font: {e}. Falling back to Helvetica.")
else:
    print("Tunga font not found at default Windows path. Using Helvetica.")

def export_conversation_to_pdf(session_id: str, messages: list) -> str:
    """
    Exports a list of conversation messages to a beautifully styled police transcript PDF.
    Features robust fallback formatting to ensure zero crashes on Kannada characters.
    """
    filename = f"KSP_Chat_Report_{session_id}.pdf"
    file_path = EXPORT_DIR / filename
    
    # Establish Document
    doc = SimpleDocTemplate(
        str(file_path),
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    active_font = FONT_NAME
    
    def build_story(use_ascii=False):
        # 1. Custom Styles Definition
        banner_title_style = ParagraphStyle(
            'BannerTitle',
            parent=styles['Heading1'],
            fontName=active_font,
            fontSize=16,
            leading=18,
            textColor=colors.white,
            alignment=1, # Center
        )
        
        banner_subtitle_style = ParagraphStyle(
            'BannerSub',
            parent=styles['Normal'],
            fontName=active_font,
            fontSize=9,
            leading=11,
            textColor=colors.HexColor('#94A3B8'),
            alignment=1, # Center
        )
        
        meta_style = ParagraphStyle(
            'MetaStyle',
            parent=styles['Normal'],
            fontName=active_font,
            fontSize=9,
            leading=11,
            textColor=colors.HexColor('#64748B'),
            alignment=1,
            spaceAfter=15
        )
        
        user_msg_style = ParagraphStyle(
            'UserMsg',
            parent=styles['Normal'],
            fontName=active_font,
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#1E293B'),
        )
        
        agent_msg_style = ParagraphStyle(
            'AgentMsg',
            parent=styles['Normal'],
            fontName=active_font,
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#0F172A'),
        )
        
        disclaimer_style = ParagraphStyle(
            'Disclaimer',
            parent=styles['Normal'],
            fontName=active_font,
            fontSize=8,
            leading=10,
            textColor=colors.HexColor('#94A3B8'),
            alignment=1
        )
        
        story = []
        
        # 2. Top Banner Header
        banner_data = [
            [Paragraph("<b>KARNATAKA STATE POLICE</b>", banner_title_style)],
            [Paragraph("CRIME INTELLIGENCE DEPARTMENT &bull; OFFICIAL TRANSCRIPT &bull; RESTRICTED", banner_subtitle_style)]
        ]
        banner_table = Table(banner_data, colWidths=[530])
        banner_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#0F172A')), # Dark navy
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOX', (0, 0), (-1, -1), 1.5, colors.HexColor('#1E293B')),
        ]))
        
        story.append(banner_table)
        story.append(Spacer(1, 10))
        
        # Metadata block
        timestamp_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        story.append(Paragraph(
            f"<b>Session ID:</b> {session_id}  |  <b>Generated:</b> {timestamp_str}  |  <b>Classification:</b> RESTRICTED JURISDICTION ONLY", 
            meta_style
        ))
        
        # 3. Conversation rows
        data = []
        t_styles = []
        
        for idx, msg in enumerate(messages):
            sender = msg.get("sender", "User")
            text = msg.get("text", "")
            time_str = msg.get("timestamp", "")
            if isinstance(time_str, datetime.datetime):
                time_str = time_str.strftime("%H:%M:%S")
                
            role_label = "INVESTIGATOR" if sender == "User" else "KSP AI AGENT"
            p_style = user_msg_style if sender == "User" else agent_msg_style
            
            # Sanitize to ASCII if fallback requested
            if use_ascii:
                text = text.encode('ascii', 'ignore').decode('ascii')
                if not text.strip():
                    text = "[Kannada Script Text Omitted for PDF Compatibility]"
            
            # Replace markdown bullet blocks with clean layout formatting
            text_cleaned = text.replace("\n•\n", "\n• ").replace("\n-\n", "\n- ")
            formatted_text = text_cleaned.replace("\n", "<br/>")
            
            row_content = f"<b>{role_label}</b> &nbsp;&bull;&nbsp; <font color='#64748B'>{time_str}</font><br/><br/>{formatted_text}"
            p = Paragraph(row_content, p_style)
            data.append([p])
            
            # Chat bubble styling
            bg_color = colors.HexColor('#F8FAFC') if sender == "User" else colors.HexColor('#F5F3FF') # Gray vs Light Purple
            border_color = colors.HexColor('#E2E8F0') if sender == "User" else colors.HexColor('#DDD6FE')
            sidebar_color = colors.HexColor('#3B82F6') if sender == "User" else colors.HexColor('#8B5CF6') # Blue vs Purple Left Border
            
            t_styles.extend([
                ('BACKGROUND', (0, idx), (0, idx), bg_color),
                ('BOX', (0, idx), (0, idx), 1, border_color),
                ('LINELEFT', (0, idx), (0, idx), 3.5, sidebar_color), # Thick accent bar
                ('TOPPADDING', (0, idx), (0, idx), 10),
                ('BOTTOMPADDING', (0, idx), (0, idx), 12),
                ('LEFTPADDING', (0, idx), (0, idx), 14),
                ('RIGHTPADDING', (0, idx), (0, idx), 14),
            ])
            
        table = Table(data, colWidths=[530])
        table.setStyle(TableStyle(t_styles + [
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        story.append(table)
        story.append(Spacer(1, 20))
        
        # 4. Disclaimer
        story.append(Paragraph(
            "This transcript is generated automatically from the KSP Crime AI platform. Confidentiality rules apply. "
            "Unauthorised dissemination or reproduction is strictly punishable under the KSP Information Security & Official Secrets protocols.", 
            disclaimer_style
        ))
        
        return story

# Render Document
    try:
        story = build_story(use_ascii=False)
        doc.build(story)
    except Exception as e:
        print(f"Unicode character detected or font failure: {e}. Retrying with sanitized ASCII text and Helvetica.")
        active_font = "Helvetica"
        story = build_story(use_ascii=True)
        doc.build(story)
        
    return str(file_path)
