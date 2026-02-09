import time

from models import MessageType

from bridge.meshtastic_bridge import convert_meshtastic_message_to_mesh_message


def test_convert_meshtastic_packet_prefers_json_payload():
    now = int(time.time())
    packet = {
        "fromId": "!abcd",
        "rxTime": now,
        "decoded": {
            "text": (
                '{'
                '"node_id":"node-001",'
                f'"timestamp":{now},'
                '"message_type":"supply_request",'
                '"urgency":2,'
                '"lat":43.0,'
                '"lon":-80.0,'
                '"resource_type":"water",'
                '"quantity":3,'
                '"payload":"hi"'
                "}"
            )
        },
    }

    msg = convert_meshtastic_message_to_mesh_message(None, packet, packet["decoded"]["text"])
    assert msg is not None
    assert msg.node_id == "node-001"
    assert msg.timestamp == now
    assert msg.message_type.value == "supply_request"
    assert msg.urgency == 2


def test_convert_meshtastic_packet_fallback_broadcast():
    now = int(time.time())
    packet = {"fromId": "!beef", "rxTime": now, "decoded": {"text": "hello world"}}

    msg = convert_meshtastic_message_to_mesh_message(None, packet, packet["decoded"]["text"])
    assert msg is not None
    assert msg.node_id == "!beef"
    assert msg.timestamp == now
    assert msg.message_type == MessageType.BROADCAST
    assert msg.urgency == 1


def test_convert_meshtastic_packet_fallback_sos_detection():
    packet = {"fromId": "!cafe", "decoded": {"text": "SOS need help"}}

    msg = convert_meshtastic_message_to_mesh_message(None, packet, packet["decoded"]["text"])
    assert msg is not None
    assert msg.node_id == "!cafe"
    assert msg.message_type == MessageType.SOS
    assert msg.urgency == 3

