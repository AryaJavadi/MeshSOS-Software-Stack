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

for testing
- have the nodes directly connected and send a message to see if it displays on log 
- if nothing shows up, might have to change 'pub.subscribe(on_receive, "meshtastic.receive")' to ''pub.subscribe(on_receive, "meshtastic.receive.text")'
- then we should also test its being written to the sqlite db
