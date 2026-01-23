# Ports:

To find the USB serial device

'''
ls /dev/cu.*
'''

Run the meshtastic bridge:
'''python -m bridge.meshtastic_bridge /dev/cu.usbmodemXXXX'''

Similar logic via Raspberry Pi 

If running into issues w/ meshtastic library, create a venv and pip install there. 
'''source venv/bin/activate'''

when nodes are directly connected, to view messages that's being written to sqlite db:
'''
sqlite3 backend/meshsos.db "select id,node_id,message_type,urgency,timestamp,payload from messages order by id desc limit 5;"
'''


for later:
- for position data likey change 'pub.subscribe(on_receive, "meshtastic.receive")' to ''pub.subscribe(on_receive, "meshtastic.receive.text")'
- figure out logic on raspberry pi
