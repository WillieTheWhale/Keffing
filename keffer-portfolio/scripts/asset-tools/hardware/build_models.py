"""Run from Blender's Python Console through Computer Use, never headless.

Editable original low-poly meshes; one packed .blend and animated GLB per device.
Coordinates are centimetres in Blender; glTF export uses metres. Frame 1 is the
resting pose, frame 49 is revealed. Each moving assembly has a named pivot.
"""
import bpy, math, json, traceback
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix
from math import sin, cos, pi, radians

ROOT=Path(__file__).resolve().parents[3]
ART=ROOT/'artwork/hardware'; TEX=ART/'textures'; WEB=ROOT/'public/assets/hardware'
ART.mkdir(parents=True,exist_ok=True); WEB.mkdir(parents=True,exist_ok=True)
QA=ART/'qa';QA.mkdir(exist_ok=True)
PALETTE=json.loads((TEX/'palette.json').read_text())
DECALS=json.loads((TEX/'decals.json').read_text())
GLYPHS=json.loads((TEX/'glyphs.json').read_text())
MATS={}; ROOT_OBJ=None; MOVING=[]

def material(texture, alpha=False, emission=False, metal=0):
    key=(texture,alpha,emission,metal)
    if key in MATS:return MATS[key]
    m=bpy.data.materials.new(texture+('_metal' if metal else ''));m.use_nodes=True
    n=m.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');s=n.new('ShaderNodeBsdfPrincipled')
    s.inputs['Roughness'].default_value=.73;s.inputs['Metallic'].default_value=metal
    img=n.new('ShaderNodeTexImage');img.image=bpy.data.images.load(str(TEX/(texture+'.png')),check_existing=True);img.interpolation='Closest'
    m.node_tree.links.new(img.outputs['Color'],s.inputs['Base Color'])
    if alpha:m.node_tree.links.new(img.outputs['Alpha'],s.inputs['Alpha']);m.surface_render_method='DITHERED'
    if emission:
        m.node_tree.links.new(img.outputs['Color'],s.inputs['Emission Color']);s.inputs['Emission Strength'].default_value=.35
    m.node_tree.links.new(s.outputs[0],out.inputs[0]);MATS[key]=m;return m

def uv_rect(obj,rect,dim=(512,512)):
    x,y,w,h=rect;tw,th=dim;uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='PixelUV')
    coords=[(x/tw,1-(y+h)/th),((x+w)/tw,1-(y+h)/th),((x+w)/tw,1-y/th),(x/tw,1-y/th)]
    for poly in obj.data.polygons:
        for j,l in enumerate(poly.loop_indices):uv.data[l].uv=coords[j%4]

def finish(obj,color,metal=.0):
    obj.data.materials.append(material('finish-palette',metal=metal))
    i=PALETTE[color];uv_rect(obj,(i%8*32+4,i//8*32+4,24,24),(256,128))
    return obj

def mesh(name,verts,faces,color,parent=None,metal=0):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.parent=parent or ROOT_OBJ
    if color:finish(o,color,metal)
    return o

def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent or ROOT_OBJ;o.location=loc;o.empty_display_size=.25;return o

def slab(name,loc,dims,color,r=.1,edge=.025,parent=None,segments=3,metal=0):
    w,d,h=dims;r=min(r,w/2-.001,d/2-.001);edge=min(edge,h*.3,r*.5)
    verts=[]
    for z,inset in [(-h/2,edge),(-h/2+edge,0),(h/2-edge,0),(h/2,edge)]:
        rr=max(.001,r-inset)
        for cx,cy,start in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
            for j in range(segments+1):
                a=radians(start+j*90/segments);verts.append((cx+rr*cos(a),cy+rr*sin(a),z))
    n=4*(segments+1);faces=[tuple(reversed(range(n))),tuple(range(3*n,4*n))]
    for layer in range(3):
        for j in range(n):faces.append((layer*n+j,layer*n+(j+1)%n,(layer+1)*n+(j+1)%n,(layer+1)*n+j))
    o=mesh(name,verts,faces,color,parent,metal);o.location=loc;return o

def box(name,loc,dims,color,parent=None):
    w,d,h=[v/2 for v in dims]
    o=mesh(name,[(-w,-d,-h),(w,-d,-h),(w,d,-h),(-w,d,-h),(-w,-d,h),(w,-d,h),(w,d,h),(-w,d,h)],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],color,parent);o.location=loc;return o

def cylinder(name,loc,radius,depth,color,parent=None,vertices=12,axis='z',scale=None):
    verts=[]
    for z in [-depth/2,depth/2]:
        verts += [(radius*cos(2*pi*i/vertices),radius*sin(2*pi*i/vertices),z) for i in range(vertices)]
    faces=[tuple(reversed(range(vertices))),tuple(range(vertices,vertices*2))]
    faces += [(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]
    o=mesh(name,verts,faces,color,parent);o.location=loc
    if axis=='x':o.rotation_euler.y=pi/2
    if axis=='y':o.rotation_euler.x=pi/2
    if scale:o.scale=scale
    return o

def sphere(name,loc,scale,color,parent=None,segments=12,rings=6):
    verts=[(0,0,-1)];faces=[]
    for j in range(1,rings):
        lat=-pi/2+pi*j/rings
        for i in range(segments):verts.append((cos(lat)*cos(2*pi*i/segments),cos(lat)*sin(2*pi*i/segments),sin(lat)))
    verts.append((0,0,1));top=len(verts)-1
    for i in range(segments):faces.append((0,1+(i+1)%segments,1+i))
    for j in range(rings-2):
        a=1+j*segments;b=a+segments
        for i in range(segments):faces.append((a+i,a+(i+1)%segments,b+(i+1)%segments,b+i))
    for i in range(segments):faces.append((top,1+(rings-2)*segments+i,1+(rings-2)*segments+(i+1)%segments))
    o=mesh(name,verts,faces,color,parent);o.location=loc;o.scale=scale;return o

def panel(name,loc,w,h,texture,rect=None,parent=None,down=False,alpha=False,emission=False):
    verts=[(-w/2,-h/2,0),(w/2,-h/2,0),(w/2,h/2,0),(-w/2,h/2,0)]
    if down:verts=[(x,-y,z) for x,y,z in verts]
    o=mesh(name,verts,[(0,1,2,3)],None,parent);o.location=loc;o.data.materials.append(material(texture,alpha,emission))
    img=bpy.data.images.get(texture+'.png');sz=tuple(img.size[:])
    uv_rect(o,rect or (0,0,*sz),sz);return o

def decal(name,loc,w,h,key,parent=None,down=False):return panel(name,loc,w,h,'decals',DECALS[key],parent,down,True)

def animate(o,path,end,start=None,delay=0):
    start=tuple(getattr(o,path)) if start is None else start
    setattr(o,path,start);o.keyframe_insert(data_path=path,frame=1)
    if delay:o.keyframe_insert(data_path=path,frame=delay)
    setattr(o,path,end);o.keyframe_insert(data_path=path,frame=49)
    o.animation_data.action.name='Reveal_'+o.name
    MOVING.append(o)

def lid(name,hinge,w,d,t,color,open_angle=112):
    p=empty(name,hinge);slab(name+'_shell',(0,-d/2,t/2),(w,d,t),color,r=.26,edge=.04,parent=p)
    animate(p,'rotation_euler',(-radians(open_angle),0,0));return p

def keyboard(parent,width,depth,z,y,light=False):
    # Sculpted low-poly keycaps and UV legends, including a distinct function row.
    keycolor='silver' if light else 'black';legend='keys-dark' if light else 'keys-light'
    rows=['1234567890-=', 'QWERTYUIOP[]', 'ASDFGHJKL;\'', 'ZXCVBNM,./']
    kw=width/14;kh=depth/6
    for row in range(6):
        yy=y+depth/2-kh*(row+.5)
        if row==0:chars='1234567890-=';count=14
        elif row<5:chars=rows[row-1];count=14
        else:chars='';count=8
        for col in range(count):
            if row==5:
                widths=[1,1,1,5,1,1,1,1];units=sum(widths[:col]);ww=widths[col]*kw;xx=-width/2+units*kw+ww/2
            else:ww=kw;xx=-width/2+(col+.5)*kw
            key=slab('Key_%02d_%02d'%(row,col),(xx,yy,z),(ww*.9,kh*(.62 if row==0 else .83),.105),keycolor,r=.055,edge=.019,parent=parent,segments=1)
            c=chars[col%len(chars)] if chars else ''
            if c in GLYPHS:panel('Legend', (xx,yy,z+.054),kw*.58,kh*.68,legend,GLYPHS[c],parent,alpha=True)

def port(name,loc,w,h,side='front',color='ink',parent=None):
    o=slab(name,loc,(w,.022,h),color,r=.012,edge=.003,parent=parent,segments=1)
    if side in ['left','right']:o.rotation_euler.z=pi/2
    return o

def macbook():
    w=35.57;d=24.81;t=1.1
    slab('Space_black_unibody',(0,0,.7),(w,d,t),'space',r=.72,edge=.11,metal=.25)
    slab('Bottom_shell',(0,0,.15),(w-.16,d-.1,.28),'edge',r=.7,edge=.04)
    slab('Keyboard_well',(0,3.0,1.27),(28.5,10.4,.08),'rubber',r=.4,edge=.015)
    keyboard(None,27.8,9.5,1.38,3.0)
    slab('Trackpad_outline',(0,-7.0,1.264),(15.2,8.15,.045),'gray',r=.35,edge=.01)
    slab('Force_touch_trackpad',(0,-7.0,1.29),(15.05,8.0,.04),'space',r=.32,edge=.01)
    for x in [-15.8,15.8]:
        box('Speaker_grille',(x,3.0,1.273),(1.8,10,.028),'rubber')
        for y in range(24):box('Speaker_perforation',(x,-1.55+y*.38,1.295),(1.55,.07,.016),'space')
    cylinder('Continuous_hinge',(0,11.87,1.36),.32,28.0,'black',axis='x',vertices=12)
    p=lid('Display_hinge',(0,11.85,1.46),w,24.1,.43,'space',112)
    slab('Display_bezel',(0,-12.05,-.013),(34.9,23.5,.03),'black',r=.45,edge=.005,parent=p)
    panel('macOS_desktop',(0,-12.36,-.036),34.1,22.03,'screen-macbook',parent=p,down=True,emission=True)
    slab('Camera_notch',(0,-23.05,-.055),(3.5,.75,.04),'black',r=.16,edge=.005,parent=p)
    cylinder('FaceTime_camera',(0,-23.03,-.083),.11,.014,'lens',p,12)
    decal('Apple_lid_mark',(0,-12.1,.437),3.9,3.9,'apple-dark',p)
    for x in [-14.8,14.8]:
        for y in [-9.7,9.7]:cylinder('Rubber_foot',(x,y,-.031),.8,.08,'black',vertices=12)
    for y in [6.7,8.7]:port('Thunderbolt_left',(-17.795,y,.64),1.0,.29,'left')
    port('MagSafe',(-17.795,10.5,.64),1.45,.28,'left');port('Headphone',(-17.795,4.8,.64),.38,.38,'left')
    port('HDMI',(17.795,9.7,.64),1.4,.4,'right');port('Thunderbolt_right',(17.795,7.3,.64),1.0,.29,'right');port('SDXC',(17.795,3.7,.64),2.75,.14,'right')
    port('Finger_scoop',(0,-12.42,1.13),5.0,.2)

def panasonic():
    w=29.5;d=21.62
    slab('Magnesium_base',(0,0,.91),(w,d,1.82),'silver',r=.43,edge=.12,metal=.18)
    slab('Base_seam',(0,0,.26),(w-.08,d-.03,.11),'darkSilver',r=.4,edge=.02)
    slab('Keyboard_recess',(0,3.9,1.85),(28,10.5,.06),'gray',r=.12,edge=.01)
    keyboard(None,27.2,9.65,1.96,3.95,True)
    # CF-SX1's distinctive circular wheel pad and two curved click buttons.
    cylinder('Wheel_pad_rim',(-2.2,-6.6,1.89),2.83,.06,'darkSilver',vertices=24)
    cylinder('Wheel_pad_inner_rim',(-2.2,-6.6,1.933),2.61,.035,'silver',vertices=24)
    cylinder('Circular_touchpad',(-2.2,-6.6,1.962),2.21,.04,'warmGray',vertices=24)
    for x in [-3.4,-1.0]:slab('Mouse_button',(x,-9.44,1.97),(2.24,1.0,.1),'silver',r=.17,edge=.025,segments=2)
    # Top-loading optical-drive lid in the right palm rest, not a side tray.
    slab('DVD_cover_seam',(8.4,-6.15,1.85),(10.5,8.8,.04),'darkSilver',r=.4,edge=.009)
    slab('DVD_top_loading_cover',(8.4,-6.15,1.884),(10.36,8.66,.045),'silver',r=.36,edge=.012)
    decal('DVD_mark',(10,-9.4,1.92),3.0,.62,'dvd')
    for i,c in enumerate(['blue','cyan','green']):slab('Palmrest_sticker',(12.1,-3.0-i*.95,1.93),(1.15,.78,.02),c,r=.08,edge=.002,segments=1)
    cylinder('Rear_battery',(0,10.4,.93),.84,28.4,'warmGray',vertices=8,axis='x')
    p=lid('Display_hinge',(0,10.08,2.04),29.5,20.9,.53,'blue',110)
    slab('Silver_screen_surround',(0,-10.45,-.023),(28.9,20.3,.065),'silver',r=.21,edge=.01,parent=p)
    slab('Screen_gasket',(0,-10.74,-.06),(27.55,16.15,.03),'rubber',r=.12,edge=.005,parent=p)
    panel('Lets_note_display',(0,-10.74,-.08),26.75,15.05,'screen-panasonic',parent=p,down=True,emission=True)
    decal('Screen_brand',(-10.15,-1.75,-.067),5.1,.85,'panasonic',p,True)
    decal('Model_designation',(-6.2,-1.75,-.067),2.5,.6,'model',p,True)
    decal('Series_mark',(11.0,-1.75,-.067),4.0,.65,'letsnote',p,True)
    cylinder('Webcam',(0,-19.18,-.074),.2,.035,'black',p,12)
    for x in [-10.1,-3.6,3.6,10.1]:
        slab('Bonnet_ridge',(x,-10.4,.54),(.18,17.8,.14),'blueEdge',r=.07,edge=.02,parent=p,segments=1)
    decal('Panasonic_lid',(0,-8.2,.62),6.2,1.08,'panasonic',p)
    for x in [-12.3,12.3]:cylinder('Hinge_end',(x,10.0,1.9),.34,3.1,'bright',axis='x')
    for y in [4.0,5.0,6.0,7.0,8.0]:port('Fan_exhaust',(-14.76,y,.97),.52,.95,'left')
    port('VGA_connector',(-14.77,0.1,.91),2.25,.87,'left',color='blue');port('HDMI',(-14.77,2.1,.91),1.15,.46,'left')
    for y in [-2.2,-4.1]:port('USB_3',(-14.77,y,.92),1.2,.53,'left')
    port('Ethernet',(14.76,2.8,.85),1.55,1.03,'right');port('USB_2',(14.76,.1,.92),1.3,.5,'right');port('SD_card',(14.76,-2.2,1.35),2.65,.15,'right')
    for x in [-5.4,-3.6]:port('Audio_jack',(x,-10.82,.74),.45,.45)
    port('Power_light',(-13.0,-10.83,.9),1.0,.64,color='green')

def dpad(name,x,y,z,color,parent=None,size=1):
    box(name+'_vertical',(x,y,z),(.36*size,1.2*size,.14*size),color,parent)
    box(name+'_horizontal',(x,y,z),(1.2*size,.36*size,.145*size),color,parent)

def button(name,x,y,z,r,color,parent=None,letter=None):
    cylinder(name,(x,y,z),r,.14,color,parent,12)
    if letter in GLYPHS:panel(name+'_legend',(x,y,z+.074),r*1.3,r*1.3,'keys-light',GLYPHS[letter],parent,alpha=True)

def shield_art(p):
    # Raised perimeter and hand-built embossed crest follow the special edition.
    z=.405
    outline=[(-7.78,-.48),(-7.78,-7.95),(-7.42,-8.6),(-6.45,-8.8),(-4.6,-8.8),(-4.1,-8.1),(-3.0,-8.1),(-2.5,-8.8),(2.5,-8.8),(3.,-8.1),(4.1,-8.1),(4.6,-8.8),(6.45,-8.8),(7.42,-8.6),(7.78,-7.95),(7.78,-.48),(6.3,-.48),(5.9,-1.28),(-5.9,-1.28),(-6.3,-.48)]
    # Each strip is independent editable metal trim; silhouette not a flat photo.
    for i,(x,y) in enumerate(outline):
        xx,yy=outline[(i+1)%len(outline)];dx=xx-x;dy=yy-y
        o=box('Raised_shield_rim',((x+xx)/2,(y+yy)/2,z+.07),((dx*dx+dy*dy)**.5,.36,.2),'bright',p);o.rotation_euler.z=math.atan2(dy,dx)
    def crest(name,points,col,height=.02):
        o=mesh(name,[(x,y,z+height) for x,y in points],[tuple(range(len(points)))],col,p);return o
    for s in [-1,1]:
        crest('Upper_silver_corner',[(s*7.76,-.50),(s*6.25,-.50),(s*6.42,-1.42),(s*6.9,-1.88),(s*7.76,-1.32)],'bright',.18)
        crest('Side_silver_plate',[(s*7.78,-3.45),(s*6.95,-4.05),(s*6.76,-5.13),(s*7.78,-5.64)],'bright',.18)
        for yy in [-4.16,-4.55,-4.94]:
            crest('Side_engraved_chevron',[(s*7.53,yy),(s*7.12,yy-.13),(s*7.5,yy-.19)],'gray',.195)
    # Triforce sits toward the hinge side of the lid.
    for x,y in [(0,-2.25),(-.67,-3.39),(.67,-3.39)]:crest('Golden_Triforce',[(x,y),(x-.63,y-1.06),(x+.63,y-1.06)],'gold',.23)
    # Silver heraldic horns around the Triforce.
    for s in [-1,1]:
        pts=[(.9,-2.1),(1.55,-2.0),(1.95,-2.5),(1.55,-2.65),(2.0,-3.5),(2.65,-3.35),(2.6,-2.6),(2.9,-2.25),(3.25,-3.35),(2.8,-3.95),(1.68,-4.0),(1.18,-3.05)]
        crest('Silver_crest',[(s*x,y) for x,y in pts],'bright',.2)
    # Angular crimson Loftwing: wings, talons, body and head.
    crest('Crimson_bird_body',[(0,-4.38),(-.45,-4.85),(-.24,-5.5),(-.58,-5.9),(0,-7.65),(.58,-5.9),(.24,-5.5),(.45,-4.85)],'red',.24)
    for s in [-1,1]:
        for j in range(3):
            pts=[(.5,-4.88-j*.33),(3.9-j*.6,-4.25-j*.73),(3.5-j*.5,-4.91-j*.64),(1.0,-5.48-j*.18)]
            crest('Crimson_wing',[(s*x,y) for x,y in pts],'red',.24)
        crest('Crimson_talon',[(s*.5,-6.18),(s*1.35,-6.55),(s*1.15,-7.1),(s*1.45,-7.42),(s*.74,-7.22),(s*.88,-6.8),(s*.23,-6.55)],'red',.24)
    for x,y in [(-7.1,-.91),(7.1,-.91),(-3.65,-8.35),(3.65,-8.35)]:
        cylinder('Shield_rivet',(x,y,z+.22),.17,.09,'steel',p,8)

def handheld(hylian=False):
    w,d=(16.34,8.6) if hylian else (16.1,9.14)
    col='shieldBlue' if hylian else 'bronze';edge='bright' if hylian else 'bronzeEdge'
    slab('Bottom_shell',(0,0,.43),(w,d,.86),edge,r=.7,edge=.09)
    slab('Control_deck',(0,0,.91),(w-.10,d-.12,.23),col,r=.66,edge=.03)
    sw,sh=(8.65,6.49) if hylian else (8.6,6.45)
    slab('Touchscreen_bezel',(0,-.13,1.04),(sw+.38,sh+.35,.12),'black',r=.11,edge=.015)
    panel('Touchscreen',(0,-.13,1.108),sw,sh,'screen-touch',emission=True)
    bx=6.25;btn='bright' if hylian else 'bronzeEdge'
    if hylian:
        cylinder('Circle_pad_socket',(-bx,1.95,1.08),.91,.12,'blueEdge',vertices=20)
        cylinder('Circle_pad',(-bx,1.95,1.2),.7,.19,'ivory',vertices=16)
        dpad('D_pad',-bx,-.75,1.18,'bright',size=1.18)
        button('C_stick',5.22,2.76,1.15,.32,'ivory')
    else:dpad('D_pad',-bx,1.02,1.16,btn,size=1.05)
    for dx,dy,c in [(0,.76,'X'),(.76,0,'A'),(0,-.76,'B'),(-.76,0,'Y')]:button('Face_'+c,bx+dx,1.1+dy,1.15,.34,btn,letter=c)
    for yy,key in [(-2.03,'start'),(-2.85,'select')]:
        button(key,5.61,yy,1.13,.22,col);decal(key+'_text',(6.5,yy,1.13),1.25,.37,key)
    button('Power',-6.2,-3.12,1.12,.29,col)
    hy=d/2-.15;cylinder('Hinge_bar',(0,hy,1.18),.33,w-1.2,col,axis='x')
    cylinder('Interior_camera',(0,hy-.335,1.19),.13,.017,'black',axis='y')
    p=lid('Display_hinge',(0,hy,1.30),w,d,.38,edge,145 if hylian else 139)
    slab('Upper_inner_shell',(0,-d/2,-.025),(w-.21,d-.12,.06),col,r=.61,edge=.015,parent=p)
    upw,uph=(11.1,6.66) if hylian else (8.6,6.45)
    slab('Upper_screen_bezel',(0,-d/2,-.068),(w-.4 if hylian else upw+.4,d-.6 if hylian else uph+.4,.025),'black',r=.2,edge=.004,parent=p)
    panel('Upper_display',(0,-d/2,-.086),upw,uph,'screen-2ds' if hylian else 'screen-dsi',parent=p,down=True,emission=True)
    if hylian:
        slab('Blue_shield_field',(0,-d/2,.387),(w-.55,d-.25,.09),'shieldBlue',r=.6,edge=.02,parent=p)
        shield_art(p)
        decal('Underside_model',(0,0,-.01),7.2,.8,'2ds',down=True)
    else:
        for x in [-6.34,6.34]:
            for yy in [0,.32,.64]:
                for xx in [-.32,0,.32]:cylinder('Speaker_hole',(x+xx,-d/2+yy-.32,-.077),.065,.022,'ink',p,6)
        cylinder('Outer_camera',(-6.4,-d+1.1,.41),.27,.08,'black',p,12)
        cylinder('Outer_camera_glass',(-6.4,-d+1.1,.46),.14,.02,'lens',p,10)
        decal('Outer_DSi_brand',(0,-d/2,.388),6.0,1.15,'dsi',p)
        for x,c in [(-6.8,'green'),(-6.3,'lightBlue')]:cylinder('Hinge_LED',(x,hy-.15,1.46),.065,.02,c,vertices=6)
    for x in [-6.4,6.4]:slab('Shoulder_button',(x,d/2,.73),(2.15,.6,.45),col,r=.13,edge=.055,segments=2)
    port('Cartridge_slot',(0,d/2+.025,.55),3.45,.34);port('Charge_port',(3.2,d/2+.025,.6),.76,.37)
    port('Headphone_port',(2.25,-d/2-.025,.53),.42,.42)

def dsi_bronze():
    w=16.1;d=9.14
    slab('Bronze_lower_shell',(0,0,.63),(w,d,1.26),'bronzeEdge',r=.72,edge=.11,segments=5)
    slab('Dark_brown_control_deck',(0,0,1.27),(w-.17,d-.15,.19),'bronze',r=.65,edge=.035,segments=5)
    # Both 4.2-inch screens are 4:3. The bottom bezel is a raised brown lip.
    slab('Raised_touchscreen_frame',(0,-.17,1.39),(9.35,7.21,.16),'bronze',r=.16,edge=.035,segments=3)
    slab('Touchscreen_gasket',(0,-.17,1.476),(8.99,6.84,.032),'black',r=.045,edge=.005,segments=1)
    panel('DSi_touchscreen',(0,-.17,1.496),8.54,6.41,'screen-touch',emission=True)
    dpad('Cross_control',-6.22,1.11,1.50,'bronze',size=1.32)
    for dx,dy in [(0,.55),(0,-.55),(-.55,0),(.55,0)]:
        box('Dpad_etched_mark',(-6.22+dx,1.11+dy,1.602),(.20 if dx else .035,.035 if dx else .20,.009),'warmGray')
    for dx,dy,c in [(0,.74,'X'),(.74,0,'A'),(0,-.74,'B'),(-.74,0,'Y')]:
        cylinder('Button_recess',(6.22+dx,1.28+dy,1.375),.37,.018,'black',vertices=12)
        button('Face_'+c,6.22+dx,1.28+dy,1.47,.32,'bronze',letter=c)
    for yy,key in [(-2.10,'start'),(-2.90,'select')]:
        button(key,5.27,yy,1.43,.205,'bronze')
        decal(key+'_legend',(6.33,yy,1.377),1.42,.39,key)
    cylinder('Power_button_ring',(-5.37,-2.91,1.397),.30,.04,'bronzeEdge',vertices=16)
    button('Power',-5.37,-2.91,1.44,.22,'bronze')
    decal('Power_legend',(-6.36,-2.91,1.377),1.25,.34,'power')
    hy=4.20;hz=1.56
    cylinder('Full_width_hinge',(0,hy,hz),.44,15.95,'bronze',axis='x',vertices=20)
    for x in [-6.94,6.94]:cylinder('Hinge_end_cap',(x,hy,hz),.449,1.80,'bronzeEdge',axis='x',vertices=16)
    cylinder('Inner_camera_rim',(0,hy-.443,hz+.07),.25,.025,'bronzeEdge',axis='y',vertices=16)
    cylinder('Inner_camera',(0,hy-.462,hz+.07),.18,.026,'black',axis='y',vertices=16)
    cylinder('Camera_glass',(0,hy-.479,hz+.07),.09,.006,'lens',axis='y',vertices=12)
    cylinder('Microphone',(.65,hy-.442,hz+.04),.062,.02,'ink',axis='y',vertices=8)
    p=empty('Display_hinge',(0,hy,1.65))
    slab('Gloss_brown_outer_lid',(0,-d/2,.23),(w,d,.46),'bronze',r=.72,edge=.065,parent=p,segments=5)
    slab('Bronze_lid_perimeter',(0,-d/2,.10),(w+.015,d+.015,.12),'bronzeEdge',r=.73,edge=.025,parent=p,segments=5)
    slab('Dark_brown_display_surround',(0,-d/2,-.033),(w-.19,d-.18,.085),'bronze',r=.65,edge=.022,parent=p,segments=5)
    slab('Display_moulded_lip',(0,-d/2,-.081),(9.33,7.17,.07),'bronze',r=.15,edge=.02,parent=p)
    slab('Display_gasket',(0,-d/2,-.122),(8.96,6.82,.027),'black',r=.045,edge=.005,parent=p,segments=1)
    panel('Upper_DSi_display',(0,-d/2,-.141),8.54,6.41,'screen-dsi',parent=p,down=True,emission=True)
    # The bronze XL has seven speaker holes in a hexagonal cluster, not a grid.
    for x in [-6.37,6.37]:
        for xx,yy in [(0,0),(-.31,0),(.31,0),(-.155,.27),(.155,.27),(-.155,-.27),(.155,-.27)]:
            cylinder('Speaker_perforation',(x+xx,-5.10+yy,-.091),.067,.028,'ink',p,8)
        for y in [-.68,-8.53]:slab('Rubber_screen_stop',(x,y,-.094),(.30,.33,.03),'bronze',r=.06,edge=.007,parent=p,segments=2)
    cylinder('Outer_camera_bezel',(-6.4,-8.05,.47),.29,.035,'bronzeEdge',p,16)
    cylinder('Outer_camera',(-6.4,-8.05,.494),.20,.022,'black',p,12)
    cylinder('Outer_camera_lens',(-6.4,-8.05,.509),.11,.012,'lens',p,12)
    # The actual lid is unbranded; model information is on the underside.
    decal('Underside_Nintendo_mark',(0,0,-.005),5.6,.9,'dsi',down=True)
    for i,c in enumerate(['lightBlue','gray','lightBlue']):
        port('Hinge_indicator',(-7.03+i*.27,hy-.445,hz),.075,.35,color=c)
    for x in [-6.45,6.45]:slab('Shoulder_button',(x,4.49,.94),(2.02,.55,.48),'bronze',r=.18,edge=.05,segments=3)
    port('Game_card',(0,4.588,.85),3.43,.35)
    port('Charge_port',(3.22,4.589,.89),.78,.37)
    port('Headphone_socket',(2.62,-4.58,.60),.50,.40)
    port('SD_card_cover',(8.06,-.40,.85),3.08,.65,'right',color='bronze')
    port('Volume_rocker',(-8.06,1.63,.88),1.69,.31,'left',color='bronze')
    cylinder('Stowed_stylus',(7.65,1.06,.54),.16,6.20,'bronze',axis='y',vertices=10)
    animate(p,'rotation_euler',(-radians(146),0,0))

def macmini():
    slab('Aluminium_enclosure',(0,0,2.67),(12.7,12.7,4.66),'silver',r=1.75,edge=.21,metal=.25)
    slab('Black_vented_foot',(0,0,.25),(10.7,10.7,.6),'black',r=1.5,edge=.07)
    decal('Apple_top',(0,0,5.01),3.4,3.4,'apple-dark')
    # Front I/O is vertical on the 2024 enclosure.
    for x in [-3.1,-1.45]:port('Front_USB_C',(x,-6.356,2.65),.29,.98)
    cylinder('Status_LED',(3.42,-6.365,2.68),.075,.02,'whiteBright',axis='y',vertices=8)
    cylinder('Headphone_jack',(4.55,-6.365,2.68),.22,.02,'ink',axis='y',vertices=12)
    for i in range(28):box('Cooling_vent',(-4.5+i*.33,-5.18,.34),(.14,.1,.48),'gray')
    slab('Rear_port_panel',(0,6.355,2.55),(9.35,.03,2.1),'space',r=.016,edge=.004)
    for x in [1.1,2.6,4.1]:port('Rear_Thunderbolt',(x,6.382,2.58),.31,.96)
    port('HDMI',(-.75,6.382,2.55),1.4,.54);port('Ethernet',(-2.8,6.382,2.55),1.45,1.23)
    cylinder('Power_socket',(-4.3,6.385,2.58),.35,.02,'ink',axis='y')
    cylinder('Underside_power_button',(-4,-4,-.065),.49,.05,'gray',vertices=12)
    animate(ROOT_OBJ,'rotation_euler',(0,0,-radians(24)))
    animate(ROOT_OBJ,'location',(0,0,.9))

def iphone():
    # Width, height, thickness from Apple's 16 Pro Max dimensional specifications.
    slab('Black_titanium_frame',(0,0,0),(7.76,16.3,.825),'edge',r=1.02,edge=.065,metal=.25)
    slab('Matte_glass_back',(0,0,.414),(7.64,16.18,.06),'space',r=.96,edge=.016)
    decal('Apple_back',(0,-.36,.449),1.6,1.9,'apple-dark')
    slab('Camera_island',(-1.35,5.05,.56),(4.72,4.93,.33),'space',r=.99,edge=.06)
    for x,y in [(-2.45,6.35),(-2.45,3.81),(-.12,5.09)]:
        cylinder('Titanium_lens_ring',(x,y,.89),1.06,.36,'edge',vertices=16)
        cylinder('Lens_gasket',(x,y,1.08),.93,.08,'black',vertices=16)
        cylinder('Sapphire_lens',(x,y,1.13),.75,.035,'lens',vertices=16)
        cylinder('Optical_center',(x,y,1.151),.38,.012,'ink',vertices=12)
        cylinder('Lens_glint',(x-.23,y+.23,1.16),.12,.01,'lightBlue',vertices=6)
    cylinder('TrueTone_flash',(-.12,6.74,.75),.35,.045,'cream',vertices=12)
    cylinder('LiDAR',(-.12,3.47,.76),.32,.045,'ink',vertices=12)
    slab('Front_glass',(0,0,-.418),(7.62,16.16,.04),'black',r=.94,edge=.01)
    front=panel('Lock_screen',(0,0,-.445),7.25,15.72,'screen-iphone',down=True,emission=True)
    front.rotation_euler.z=pi
    island=slab('Dynamic_Island',(0,7.0,-.46),(2.05,.55,.035),'black',r=.25,edge=.006)
    for y,h in [(4.8,.73),(2.9,1.35),(.9,1.35)]:box('Action_and_volume',(-3.895,y,0),(.075,h,.31),'steel')
    box('Side_button',(3.895,2.5,0),(.075,1.6,.31),'steel')
    box('Camera_control',(3.895,-3.7,0),(.055,1.85,.29),'darkSilver')
    port('USB_C',(0,-8.157,0),.9,.24)
    for x in [-2.6,-2.3,-2.,1.9,2.2,2.5]:cylinder('Bottom_speaker',(x,-8.16,0),.065,.02,'ink',axis='y',vertices=6)
    animate(ROOT_OBJ,'rotation_euler',(radians(12),radians(-150),radians(-8)))
    animate(ROOT_OBJ,'location',(0,0,.7))

def band(name,rx,rz,y,width,thickness,color,parent=None,start=0,end=pi,segments=16):
    verts=[]
    for i in range(segments+1):
        a=start+(end-start)*i/segments
        for radial,yy in [(-thickness/2,-width/2),(thickness/2,-width/2),(thickness/2,width/2),(-thickness/2,width/2)]:
            verts.append(((rx+radial)*cos(a),y+yy,8.8+(rz+radial)*sin(a)))
    faces=[(3,2,1,0),(4*segments,4*segments+1,4*segments+2,4*segments+3)]
    for i in range(segments):
        for j in range(4):faces.append((4*i+j,4*i+(j+1)%4,4*(i+1)+(j+1)%4,4*(i+1)+j))
    return mesh(name,verts,faces,color,parent)

def ring(name,loc,outer,inner,depth,color,parent=None,segments=20):
    verts=[];faces=[]
    for z,rx,ry in [(-depth/2,*outer),(depth/2,*outer),(depth/2,*inner),(-depth/2,*inner)]:
        verts += [(rx*cos(2*pi*i/segments),ry*sin(2*pi*i/segments),z) for i in range(segments)]
    for a,b in [(0,1),(1,2),(2,3),(3,0)]:
        for i in range(segments):faces.append((a*segments+i,a*segments+(i+1)%segments,b*segments+(i+1)%segments,b*segments+i))
    o=mesh(name,verts,faces,color,parent);o.location=loc;return o

def oval_sections(name,loc,sections,color,parent=None,segments=24):
    verts=[];faces=[]
    for z,rx,ry in sections:
        verts.extend((rx*cos(2*pi*i/segments),ry*sin(2*pi*i/segments),z) for i in range(segments))
    faces.append(tuple(reversed(range(segments))))
    for j in range(len(sections)-1):
        for i in range(segments):faces.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
    faces.append(tuple(range((len(sections)-1)*segments,len(sections)*segments)))
    o=mesh(name,verts,faces,color,parent);o.location=loc;return o

def cushion(name,parent):
    # An oval torus with a rounded leather cross-section and recessed fabric.
    verts=[];faces=[];n=28;steps=8
    for i in range(n):
        a=2*pi*i/n
        for j in range(steps):
            t=2*pi*j/steps
            verts.append(((2.57+.62*cos(t))*cos(a),(3.66+.62*cos(t))*sin(a),-1.05+.61*sin(t)))
    for i in range(n):
        for j in range(steps):faces.append((i*steps+j,((i+1)%n)*steps+j,((i+1)%n)*steps+(j+1)%steps,i*steps+(j+1)%steps))
    mesh(name,verts,faces,'darkSilver',parent)
    oval_sections('Recessed_acoustic_fabric',(0,0,-1.05),[(0,2.02,3.09),(.025,2.02,3.09)],'gray',parent)
    # Subtle ribs in the fabric, kept inside the open ear cavity.
    for i in range(-8,9):
        x=i*.20;length=5.75*max(0,1-(x/1.95)**2)**.5
        box('Fabric_weave',(x,0,-1.083),(.055,length,.012),'darkSilver',parent)

def yoke_strip(name,points,width,depth,parent):
    verts=[];faces=[]
    for i,pt in enumerate(points):
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        side=Vector((-tangent.y,tangent.x,0)).normalized()*width/2
        for q in [Vector(pt)-side-Vector((0,0,depth/2)),Vector(pt)+side-Vector((0,0,depth/2)),Vector(pt)+side+Vector((0,0,depth/2)),Vector(pt)-side+Vector((0,0,depth/2))]:verts.append(tuple(q))
    faces=[(3,2,1,0),tuple(range(4*(len(points)-1),4*len(points)))]
    for i in range(len(points)-1):
        for j in range(4):faces.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
    return mesh(name,verts,faces,'silver',parent)

def bose():
    band('Silver_headband',7.1,8.8,0,2.65,.35,'silver',segments=22)
    band('Alcantara_padding',6.72,8.38,0,2.48,.48,'darkSilver',start=.28,end=pi-.28,segments=20)
    for side,label in [(-1,'L'),(1,'R')]:
        pivot=empty('Earcup_'+label,(side*6.9,0,8.8))
        slab('Brushed_metal_slider',(0,0,-.7),(.44,2.25,1.7),'bright',r=.16,edge=.10,parent=pivot)
        cup=empty('Cup_shell_'+label,(side*.12,0,-5.6),pivot)
        cup.rotation_euler=(pi/2,0,side*pi/2)
        oval_sections('Silver_oval_shell',(0,0,0),[(-.48,2.96,4.03),(-.30,3.21,4.28),(.26,3.24,4.3),(.72,2.97,4.0),(1.04,2.28,3.05),(1.20,1.20,1.6),(1.25,.20,.27)],'silver',cup)
        ring('Cup_seal',(0,0,-.47),(3.22,4.3),(3.08,4.13),.12,'rubber',cup,28)
        cushion('Soft_oval_cushion',cup)
        for sign in [-1,1]:
            yoke_strip('Curved_fork',[(0,4.9,.16),(sign*1.4,4.45,.16),(sign*2.65,3.3,.05),(sign*3.18,1.9,-.15),(sign*3.26,.85,-.25)],.62,.32,cup)
        decal('Bose_wordmark',(0,-.10,1.259),3.15,1.22,'bose',cup)
        decal('Channel_mark',(0,0,-1.10),1.8,1.8,label,cup,True)
        for x in [1.86,2.02,2.18]:
            for yy in [-.35,-.13,.09,.31]:cylinder('Microphone_perforation',(x,yy,1.10),.045,.012,'gray',cup,6)
        if label=='R':
            slab('Power_Bluetooth_switch',(0,2.09,1.071),(.82,.4,.10),'gray',r=.17,edge=.02,parent=cup,segments=3)
            cylinder('Power_switch_grip',(0,2.09,1.139),.12,.035,'rubber',cup,8)
            for y in [-1.7,-.85,0]:box('Playback_controls',(-3.20,y,-.04),(.13,.52,.18),'gray',cup)
        animate(pivot,'rotation_euler',(0,0,0),start=(0,side*radians(28),side*radians(10)))

def airpods():
    # Apple's public Pro 3 AR model, simplified in Blender into an editable mesh.
    source=ROOT/'scripts/asset-tools/hardware/references/airpods-low-poly.json'
    parts=json.loads(source.read_text())
    offset=Vector((0,0,3.32));hinge=Vector((0,.992,3.435))
    pivots={'Case':ROOT_OBJ,'Case_lid_hinge':empty('Case_lid_hinge',hinge)}
    for side,label in [(-1,'L'),(1,'R')]:pivots['Earbud_'+label]=empty('Earbud_'+label,(side*1.50,.535,.42))
    for part in parts:
        group=part['assembly'];vertices=[]
        for xyz in part['vertices']:
            v=Vector(xyz)+offset
            if group=='Case_lid_hinge':v=Matrix.Rotation(radians(115),3,'X')@(v-hinge)
            elif group.startswith('Earbud_'):
                side=-1 if group.endswith('L') else 1
                origin=Vector((side*1.90,.10,4.42))
                v=Matrix.Rotation(side*pi/2,3,'Z')@Matrix.Rotation(radians(-23),3,'X')@(v-origin)
            vertices.append(tuple(v))
        mesh(group+'_'+part['source'],vertices,part['faces'],part['color'],pivots[group])
    animate(pivots['Case_lid_hinge'],'rotation_euler',(-radians(115),0,0))
    for side,label in [(-1,'L'),(1,'R')]:
        p=pivots['Earbud_'+label]
        animate(p,'location',(side*1.90,.10,4.42),delay=26)
        animate(p,'rotation_euler',tuple((Matrix.Rotation(radians(23),3,'X')@Matrix.Rotation(-side*pi/2,3,'Z')).to_euler()),delay=35)
    ROOT_OBJ['source']='Apple AirPods Pro 3 public AR model; Blender low-poly derivative'

def joycon_shell(name,parent,side,color):
    # Straight attachment edge; generous rounding belongs only on the outer edge.
    profile=[(-1.85,-5.10),(.04,-5.10),(.78,-4.99),(1.38,-4.57),(1.75,-3.95),(1.85,-3.30),(1.85,3.34),(1.73,4.03),(1.35,4.61),(.72,5.0),(.04,5.10),(-1.85,5.10)]
    verts=[];n=len(profile)
    for z,sx,sy in [(-.775,.86,.96),(-.45,1,1),(.51,1,1),(.775,.985,.994)]:
        verts.extend((side*x*sx,y*sy,z) for x,y in profile)
    faces=[tuple(reversed(range(n))),tuple(range(3*n,4*n))]
    for k in range(3):
        for i in range(n):faces.append((k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i))
    if side<0:faces=[tuple(reversed(f)) for f in faces]
    return mesh(name,verts,faces,color,parent)

def switch():
    slab('Tablet_back',(0,0,0),(17.3,10.2,1.39),'rubber',r=.36,edge=.12)
    slab('Display_bezel',(0,0,.71),(17.05,9.95,.065),'black',r=.22,edge=.012)
    panel('Home_screen',(0,0,.751),13.72,7.72,'screen-switch',emission=True)
    decal('Nintendo_switch_back',(0,0,-.707),6.0,1.2,'switch',down=True)
    for s,c,label in [(-1,'cyan','Left'),(1,'coral','Right')]:
        p=empty('JoyCon_'+label,(s*10.06,0,0))
        joycon_shell('Asymmetric_JoyCon_shell',p,s,c)
        box('Attachment_rail',(-s*1.79,0,0),(.13,8.8,1.20),'steel',p)
        sy=2.35 if s<0 else -1.25
        cylinder('Stick_socket',(0,sy,.80),.91,.10,'black',p,16)
        cylinder('Analog_stick',(0,sy,1.05),.71,.45,'rubber',p,16)
        cylinder('Stick_top',(0,sy,1.31),.79,.10,'black',p,16)
        by=-.85 if s<0 else 2.23
        for dx,dy,ch in [(0,.66,'X'),(.66,0,'A'),(0,-.66,'B'),(-.66,0,'Y')]:
            button('Button_'+ch,dx,by+dy,.83,.26,'black',p,letter=ch if s>0 else None)
        if s<0:
            box('Minus',(.76,4.19,.83),(.59,.13,.08),'black',p)
            slab('Capture',(.60,-3.0,.81),(.66,.66,.11),'black',r=.07,edge=.01,parent=p,segments=1)
        else:
            dpad('Plus',-.65,4.13,.82,'black',p,size=.43)
            cylinder('Home_button',(-.5,-3.1,.82),.34,.1,'steel',p,12)
            cylinder('Home_icon',(-.5,-3.1,.88),.22,.03,'black',p,10)
        slab('Shoulder_trigger',(-s*.08,4.61,-.31),(3.10,.88,.55),'black',r=.39,edge=.09,parent=p,segments=3)
        slab('L_R_bumper',(-s*.04,4.91,.35),(2.91,.25,.27),'rubber',r=.11,edge=.05,parent=p,segments=2)
        for yy in [-2,2]:box('SL_SR',(-s*1.84,yy,0),(.06,.69,.36),c,p)
        animate(p,'location',(s*11.68,.76,.30));animate(p,'rotation_euler',(0,s*radians(-5),s*radians(-5)))
    for x in [-6.8,6.8]:
        for i in range(4):box('Front_speaker',(x+i*.16-.24,-4.47,.751),(.07,.3,.025),'gray')
    for i in range(9):port('Top_exhaust',(-2.6+i*.56,5.115,0),.37,.47)
    port('USB_C',(0,-5.116,0),.88,.25)
    stand=empty('Kickstand_hinge',(6.1,2.8,-.72))
    slab('Narrow_original_kickstand',(0,-2.68,-.03),(2.4,5.36,.11),'black',r=.14,edge=.02,parent=stand)

BUILDERS={'macbook-pro-m4-max':macbook,'panasonic-cf-sx1':panasonic,'bose-qc35':bose,'airpods-pro-3':airpods,'iphone-16-pro-max':iphone,'new-2ds-xl-hylian':lambda:handheld(True),'dsi-xl-bronze':dsi_bronze,'mac-mini-2024':macmini,'nintendo-switch':switch}

def build(slug):
    global ROOT_OBJ,MATS,MOVING
    ROOT_OBJ=None;MATS={};MOVING=[]
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for datablocks in [bpy.data.meshes,bpy.data.materials,bpy.data.images,bpy.data.actions,bpy.data.cameras,bpy.data.lights]:
        for data in list(datablocks):
            if data.users==0:datablocks.remove(data)
    scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=49;scene.render.fps=24
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=.01
    ROOT_OBJ=empty('Device');ROOT_OBJ['device']=slug;ROOT_OBJ['style']='PS2-inspired low-poly';ROOT_OBJ['reveal_frames']='1 closed / 49 open'
    BUILDERS[slug]()
    # Consolidate static pieces by parent and material. Pivots remain separate,
    # while each device needs only a few draws per moving assembly on the web.
    groups={}
    for o in list(scene.objects):
        if o.type=='MESH':groups.setdefault((o.parent,o.data.materials[0]),[]).append(o)
    for (parent,mat),objects in groups.items():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
        objects[0].name=(parent.name if parent else 'Device')+'__'+mat.name
    scene.frame_set(1)
    # Export all named pivot clips. The website samples them together, and the
    # independent assemblies remain editable inside the native Blender project.
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(WEB/(slug+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='SCENE',export_frame_range=True,export_force_sampling=True,export_yup=True,export_apply=False,export_extras=True)
    triangles=sum(len(p.vertices)-2 for o in scene.objects if o.type=='MESH' for p in o.data.polygons)
    objects=sum(o.type=='MESH' for o in scene.objects)
    # Pack all textures so each .blend is independently portable.
    bpy.ops.file.pack_all()
    setup_preview(slug)
    scene.frame_set(49)
    bpy.ops.wm.save_as_mainfile(filepath=str(ART/(slug+'.blend')))
    result={'slug':slug,'triangles':triangles,'meshes':objects,'movingAssemblies':[o.name for o in set(MOVING)],'bytes':(WEB/(slug+'.glb')).stat().st_size}
    (QA/(slug+'.json')).write_text(json.dumps(result,indent=2))
    print('HARDWARE_COMPLETE',result)
    return result

def setup_preview(slug):
    scene=bpy.context.scene;scene.frame_set(49)
    mesh_objects=[o for o in scene.objects if o.type=='MESH']
    pts=[o.matrix_world@Vector(v) for o in mesh_objects for v in o.bound_box]
    lo=Vector(tuple(min(v[i] for v in pts) for i in range(3)));hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)))
    center=(lo+hi)/2;size=max(hi-lo)
    scene.world.color=(.24,.24,.24)
    camera_data=bpy.data.cameras.new('Preview_camera');cam=bpy.data.objects.new('Preview_camera',camera_data);scene.collection.objects.link(cam)
    if slug=='bose-qc35':direction=Vector((.8,-1.5,.55))
    elif slug=='iphone-16-pro-max':direction=Vector((.45,-.55,1.7))
    elif slug=='nintendo-switch':direction=Vector((.25,-.50,1.6))
    else:direction=Vector((.95,-1.40,1.03))
    cam.location=center+direction.normalized()*size*2.7;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    camera_data.type='ORTHO';camera_data.ortho_scale=size*1.68;scene.camera=cam
    for name,offset,power,scale in [('Key',(-1,-1,2),1700,1.5),('Fill',(1,-.2,1),1100,1.2),('Rim',(0,1,1.5),1500,1.0)]:
        data=bpy.data.lights.new(name,'AREA');light=bpy.data.objects.new(name,data);scene.collection.objects.link(light)
        light.location=center+Vector(offset)*size;light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler();data.energy=power*(size/10)**2;data.shape='DISK';data.size=size*scale
    scene.render.engine='CYCLES';scene.cycles.samples=24
    scene.render.resolution_x=720;scene.render.resolution_y=620;scene.render.resolution_percentage=100;scene.render.film_transparent=True
    scene.view_settings.view_transform='Standard';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(WEB/(slug+'.png'))
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='CONSOLE':area.type='VIEW_3D'
            if area.type=='VIEW_3D':
                space=next((s for s in area.spaces if s.type=='VIEW_3D'),None)
                if space:
                    space.region_3d.view_perspective='CAMERA';space.shading.type='MATERIAL';space.overlay.show_overlays=False
    bpy.ops.object.select_all(action='DESELECT');ROOT_OBJ.select_set(True);bpy.context.view_layer.objects.active=ROOT_OBJ

def build_all():
    results=[]
    for slug in BUILDERS:
        try:results.append(build(slug))
        except Exception:
            (QA/'build-error.txt').write_text(traceback.format_exc());raise
    (WEB/'manifest.json').write_text(json.dumps(results,indent=2))
    print('ALL_NINE_HARDWARE_MODELS_COMPLETE')

def run_batch():
    """Yield the Console before changing it to a saved, camera-ready 3D view."""
    queue=list(BUILDERS);results=[]
    def next_device():
        try:
            if not queue:
                (WEB/'manifest.json').write_text(json.dumps(results,indent=2))
                (QA/'batch-status.txt').write_text('Complete: all nine native files, GLBs, and renders.')
                return None
            slug=queue.pop(0)
            (QA/'batch-status.txt').write_text('Building '+slug)
            results.append(build(slug))
            bpy.ops.render.render(write_still=True)
            return .1
        except Exception:
            (QA/'batch-status.txt').write_text(traceback.format_exc())
            return None
    bpy.app.timers.register(next_device,first_interval=.1)

def audit_native():
    """Reopen all nine native files and verify that they stand alone."""
    reports=[]
    for slug in BUILDERS:
        bpy.ops.wm.open_mainfile(filepath=str(ART/(slug+'.blend')),load_ui=False)
        scene=bpy.context.scene
        meshes=[o for o in scene.objects if o.type=='MESH']
        images={node.image for o in meshes for m in o.data.materials if m and m.use_nodes for node in m.node_tree.nodes if node.type=='TEX_IMAGE' and node.image}
        animated=[o for o in scene.objects if o.animation_data and o.animation_data.action]
        assert meshes and animated,slug+' is missing geometry or animation'
        assert all(o.data.uv_layers for o in meshes),slug+' has an untextured mesh'
        assert all(i.packed_file for i in images),slug+' has an unpacked texture'
        poses=[]
        for frame in [1,25,49]:
            scene.frame_set(frame);bpy.context.view_layer.update()
            poses.append({o.name:[round(n,6) for row in o.matrix_world for n in row] for o in animated})
        assert poses[0]!=poses[2],slug+' has no movement'
        reports.append({'file':slug+'.blend','meshes':len(meshes),'packedTextures':len(images),'allMeshesHaveUVs':True,'distinctOpeningPoses':True,'frameRange':[scene.frame_start,scene.frame_end]})
    (ART/'native-validation.json').write_text(json.dumps(reports,indent=2))
    print('ALL_NINE_NATIVE_FILES_VALIDATED')

if __name__=='__main__':build_all()
