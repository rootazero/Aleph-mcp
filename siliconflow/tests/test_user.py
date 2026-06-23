from aleph_siliconflow_mcp.user import parse_model_list, parse_user_info


def test_parse_user_info_with_data_envelope():
    data = {"code": 20000, "data": {
        "name": "alice", "email": "a@x.com",
        "totalBalance": "88.88", "chargeBalance": "88.00", "balance": "0.88",
    }}
    info = parse_user_info(data)
    assert info == {
        "name": "alice", "email": "a@x.com",
        "total_balance": "88.88", "charge_balance": "88.00", "gift_balance": "0.88",
    }


def test_parse_user_info_flat_fallback():
    info = parse_user_info({"name": "bob", "totalBalance": "1.0"})
    assert info["name"] == "bob"
    assert info["total_balance"] == "1.0"


def test_parse_model_list():
    data = {"object": "list", "data": [{"id": "m1"}, {"id": "m2"}, {"nope": 1}]}
    assert parse_model_list(data) == ["m1", "m2"]
