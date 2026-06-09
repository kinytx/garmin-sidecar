CC ?= gcc
CXX ?= g++
EMCC ?= emcc

CFLAGS ?= -std=c99 -Wall -Wextra -pedantic
CXXFLAGS ?= -std=c++17 -Wall -Wextra -pedantic

C_CORE = c/garmin_ble_core.c

.PHONY: all test clean wasm

all: test

c/garmin_ble_core_test.exe: $(C_CORE) c/test_garmin_ble_core.c c/garmin_ble_core.h
	$(CC) $(CFLAGS) $(C_CORE) c/test_garmin_ble_core.c -o $@

cpp/garmin_ble_cpp_test.exe: $(C_CORE) cpp/test_garmin_ble_core.cpp cpp/garmin_ble_core.hpp c/garmin_ble_core.h
	$(CXX) $(CXXFLAGS) $(C_CORE) cpp/test_garmin_ble_core.cpp -o $@

ldc/garmin_ldc_adapter_test.exe: $(C_CORE) ldc/garmin_ldc_sidecar_adapter.c ldc/test_garmin_ldc_adapter.c ldc/garmin_ldc_sidecar_adapter.h c/garmin_ble_core.h
	$(CC) $(CFLAGS) $(C_CORE) ldc/garmin_ldc_sidecar_adapter.c ldc/test_garmin_ldc_adapter.c -o $@

ldc/garmin_ldc_sidecar_device_test.exe: $(C_CORE) ldc/garmin_ldc_sidecar_adapter.c ldc/garmin_ldc_sidecar_device.c ldc/test_garmin_ldc_sidecar_device.c ldc/garmin_ldc_sidecar_adapter.h ldc/garmin_ldc_sidecar_device.h c/garmin_ble_core.h
	$(CC) $(CFLAGS) $(C_CORE) ldc/garmin_ldc_sidecar_adapter.c ldc/garmin_ldc_sidecar_device.c ldc/test_garmin_ldc_sidecar_device.c -o $@

test: c/garmin_ble_core_test.exe cpp/garmin_ble_cpp_test.exe ldc/garmin_ldc_adapter_test.exe ldc/garmin_ldc_sidecar_device_test.exe
	c/garmin_ble_core_test.exe
	cpp/garmin_ble_cpp_test.exe
	ldc/garmin_ldc_adapter_test.exe
	ldc/garmin_ldc_sidecar_device_test.exe

wasm:
	$(EMCC) -O2 $(C_CORE) wasm/garmin_ble_wasm.c \
		-sMODULARIZE=1 \
		-sEXPORT_ES6=1 \
		-sEXPORTED_FUNCTIONS='["_malloc","_free","_garmin_wasm_init","_garmin_wasm_start","_garmin_wasm_on_notification","_garmin_wasm_send_gfdi","_garmin_wasm_request_filter","_garmin_wasm_request_directory","_garmin_wasm_request_file","_garmin_wasm_take_write","_garmin_wasm_write_ptr","_garmin_wasm_write_size","_garmin_wasm_event_type","_garmin_wasm_event_service","_garmin_wasm_event_message_id","_garmin_wasm_event_payload_ptr","_garmin_wasm_event_payload_size","_garmin_wasm_event_offset","_garmin_wasm_event_total_size","_garmin_wasm_event_file_index","_garmin_wasm_event_file_data_type","_garmin_wasm_event_file_sub_type","_garmin_wasm_event_file_size"]' \
		-o wasm/garmin_ble_core.mjs

clean:
	rm -f c/garmin_ble_core_test.exe cpp/garmin_ble_cpp_test.exe ldc/garmin_ldc_adapter_test.exe ldc/garmin_ldc_sidecar_device_test.exe wasm/garmin_ble_wasm.o wasm/garmin_ble_core.mjs wasm/garmin_ble_core.wasm
