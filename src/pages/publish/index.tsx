/**
 * 发起拼车页面
 *
 * 选择出行方向、站点出口与 2 / 3 人拼车人数，填写人均报价及等候位置、穿着、照片等辨认信息，
 * 通过 GPS 300 米距离校验后方可提交进入匹配池，并支持保存为默认信息。
 */
import { useEffect, useState } from 'react'
import { View, Text, Input, Button, Image, Switch, Map } from '@tarojs/components'
import Taro, { useLoad, useDidShow } from '@tarojs/taro'
import dayjs from 'dayjs'
import classnames from 'classnames'
import { callFunction, uploadImage } from '@/services/cloud'
import { useUserStore } from '@/store/useUserStore'
import { verifyLocation, GPS_RADIUS } from '@/utils/location'
import {
  freezeRemainMs,
  matchCooldownRemainMs,
  formatRemain,
  formatCountdown
} from '@/utils/credit'
import { CREDIT_FREEZE_DAYS, CREDIT_FREEZE_SCORE } from '@/config'
import type { Direction, GpsVerifyResult, Station, StationExit } from '@/types'
import styles from './index.module.scss'

interface SelectedExit {
  stationId: string
  stationName: string
  exit: StationExit
}

export default function PublishPage() {
  const { user, init } = useUserStore()
  const [direction, setDirection] = useState<Direction>('metro2school')
  const [stations, setStations] = useState<Station[]>([])
  const [stationsLoading, setStationsLoading] = useState(false)
  const [stationsError, setStationsError] = useState('')
  const [selected, setSelected] = useState<SelectedExit | null>(null)

  const [gps, setGps] = useState<GpsVerifyResult | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)

  const [price, setPrice] = useState('')
  const [waitLocation, setWaitLocation] = useState('')
  const [outfit, setOutfit] = useState('')
  const [photo, setPhoto] = useState('')
  const [saveAsDefault, setSaveAsDefault] = useState(false)

  const [targetSize, setTargetSize] = useState<2 | 3>(2)
  const [submitting, setSubmitting] = useState(false)

  // 每秒刷新一次，驱动冻结 / 冷却倒计时
  const [nowTick, setNowTick] = useState(Date.now())

  useLoad((options) => {
    const dir = (options?.direction as Direction) || 'metro2school'
    setDirection(dir)
  })

  useDidShow(() => {
    init().catch((err) => console.error('[Publish] init failed:', err))
  })

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 冻结剩余 / 中途退出冷却剩余（毫秒）
  const frozenMs = freezeRemainMs(user, nowTick)
  const cooldownMs = user ? matchCooldownRemainMs(user, nowTick) : 0

  useEffect(() => {
    loadStations(direction)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction])

  // 进入页面且用户设置过默认信息时，自动填充
  useEffect(() => {
    if (user) {
      if (user.defaultWaitLocation) setWaitLocation(user.defaultWaitLocation)
      if (user.defaultOutfit) setOutfit(user.defaultOutfit)
      if (user.defaultPhoto) setPhoto(user.defaultPhoto)
    }
  }, [user])

  const loadStations = async (dir: Direction) => {
    setStationsLoading(true)
    setStationsError('')
    try {
      const list = await callFunction<Station[]>('getStations', { direction: dir })
      setStations(list)
      setSelected(null)
      setGps(null)
    } catch (err) {
      console.error('[Publish] load stations failed:', err)
      setStations([])
      setStationsError((err as Error).message || '集合点加载失败，请稍后重试')
    } finally {
      setStationsLoading(false)
    }
  }

  const switchDirection = (dir: Direction) => {
    if (dir === direction) return
    setDirection(dir)
  }

  const selectExit = (stationId: string, stationName: string, exit: StationExit) => {
    setSelected({ stationId, stationName, exit })
    setGps(null)
  }

  const handleGpsVerify = async () => {
    if (!selected) {
      Taro.showToast({ title: '请先选择集合点', icon: 'none' })
      return
    }
    setGpsLoading(true)
    try {
      const result = await verifyLocation({
        latitude: selected.exit.latitude,
        longitude: selected.exit.longitude
      })
      setGps(result)
      if (result.passed) {
        Taro.showToast({ title: `距集合点 ${result.distance} 米`, icon: 'success' })
      } else {
        Taro.showModal({
          title: '位置验证未通过',
          content: `当前位置距集合点约 ${result.distance} 米，需在 ${GPS_RADIUS} 米范围内才能发起拼车。`,
          showCancel: false,
          confirmColor: '#1e6fff'
        })
      }
    } catch (err) {
      console.error('[Publish] gps verify failed:', err)
      Taro.showToast({ title: '定位失败，请检查定位权限', icon: 'none' })
    } finally {
      setGpsLoading(false)
    }
  }

  const choosePhoto = async () => {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera']
      })
      const tempPath = res.tempFiles[0].tempFilePath
      const url = await uploadImage(tempPath)
      setPhoto(url)
    } catch (err) {
      console.error('[Publish] choose photo failed:', err)
    }
  }

  const handleSubmit = async () => {
    if (frozenMs > 0) {
      Taro.showModal({
        title: '账号冻结中',
        content: `信用分低于 ${CREDIT_FREEZE_SCORE} 分，账号已冻结 ${CREDIT_FREEZE_DAYS} 天，${formatRemain(frozenMs)}后自动解冻，暂无法发起拼车。`,
        showCancel: false,
        confirmColor: '#f53f3f'
      })
      return
    }
    if (cooldownMs > 0) {
      Taro.showToast({ title: `退出冷却中，请等待 ${formatRemain(cooldownMs)}`, icon: 'none' })
      return
    }
    if (!selected) {
      Taro.showToast({ title: '请选择集合点', icon: 'none' })
      return
    }
    if (!gps?.passed) {
      Taro.showToast({ title: '请先通过位置验证', icon: 'none' })
      return
    }
    if (!price || Number(price) <= 0) {
      Taro.showToast({ title: '请填写打车参考报价', icon: 'none' })
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      // 保存默认信息
      if (saveAsDefault) {
        await callFunction('updateProfile', {
          patch: {
            defaultWaitLocation: waitLocation,
            defaultOutfit: outfit,
            defaultPhoto: photo
          }
        })
      }
      const req = await callFunction<{ id: string }>('createRideRequest', {
        direction,
        stationId: selected.stationId,
        stationName: selected.stationName,
        exitId: selected.exit.id,
        exitName: selected.exit.name,
        targetSize,
        price: Number(price),
        waitLocation,
        outfit,
        photo
      })
      // 缓存本次匹配条件，供匹配等待页展示
      Taro.setStorageSync('last_ride_cond', {
        direction,
        stationName: selected.stationName,
        exitName: selected.exit.name,
        targetSize
      })
      Taro.showToast({ title: '已进入匹配池', icon: 'success' })
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/matching/index?requestId=${req.id}` })
      }, 400)
    } catch (err) {
      console.error('[Publish] submit failed:', err)
      Taro.showToast({ title: (err as Error).message || '发起失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = !!selected && !!gps?.passed && !!price && cooldownMs === 0

  return (
    <View className={styles.page}>
      {/* 方向切换 */}
      <View className={styles.dirSwitch}>
        <View
          className={classnames(styles.dirOption, direction === 'metro2school' && styles.dirOptionMetroActive)}
          onClick={() => switchDirection('metro2school')}
        >
          地铁站 → 学校
        </View>
        <View
          className={classnames(styles.dirOption, direction === 'school2metro' && styles.dirOptionSchoolActive)}
          onClick={() => switchDirection('school2metro')}
        >
          学校 → 地铁站
        </View>
      </View>

      {/* 账号冻结：冻结期内隐藏发起表单 */}
      {frozenMs > 0 && (
        <View className={styles.blockCard}>
          <Text className={styles.blockIcon}>⛔</Text>
          <Text className={styles.blockTitle}>账号冻结中</Text>
          <Text className={styles.blockText}>
            信用分低于 {CREDIT_FREEZE_SCORE} 分，账号已冻结 {CREDIT_FREEZE_DAYS} 天
          </Text>
          <Text className={styles.blockRemain}>剩余 {formatRemain(frozenMs)}</Text>
          <Text className={styles.blockText}>
            预计 {dayjs(user?.frozenUntil || 0).format('YYYY-MM-DD HH:mm')} 自动解冻
          </Text>
          <Text className={styles.blockSub}>冻结期内无法发起拼车，到期后请通过完成行程恢复信用</Text>
        </View>
      )}

      {/* 中途退出 2 分钟匹配冷却提示 */}
      {frozenMs === 0 && cooldownMs > 0 && (
        <View className={styles.cooldownBar}>
          <Text className={styles.cooldownText}>
            中途退出冷却中，{formatRemain(cooldownMs)}后可再次发起匹配
          </Text>
          <Text className={styles.cooldownTime}>{formatCountdown(cooldownMs)}</Text>
        </View>
      )}

      {frozenMs === 0 && (
      <>
      {/* Step 1：集合点 */}
      <View className={styles.card}>
        <View className={styles.stepTitle}>
          <View className={styles.stepNo}>1</View>
          <Text className={styles.stepName}>选择集合{direction === 'metro2school' ? '地铁出口' : '校门'}</Text>
        </View>

        {stationsLoading ? (
          <Text className={styles.stationsTip}>集合点加载中…</Text>
        ) : stationsError ? (
          <View className={styles.stationsError}>
            <Text className={styles.stationsErrorText}>{stationsError}</Text>
            <View className={styles.retryBtn} onClick={() => loadStations(direction)}>
              重新加载
            </View>
          </View>
        ) : stations.length === 0 ? (
          <Text className={styles.stationsTip}>暂无可选集合点，请联系管理员维护站点数据</Text>
        ) : (
          stations.map((station) => (
            <View key={station.id}>
              <Text className={styles.stationName}>{station.name}</Text>
              <View className={styles.exitList}>
                {station.exits.map((exit) => {
                  const active = selected?.exit.id === exit.id && selected?.stationId === station.id
                  return (
                    <View
                      key={exit.id}
                      className={classnames(styles.exitItem, active && styles.exitItemActive)}
                      onClick={() => selectExit(station.id, station.name, exit)}
                    >
                      <View className={classnames(styles.radio, active && styles.radioActive)} />
                      <View className={styles.exitInfo}>
                        <Text className={styles.exitName}>{exit.name}</Text>
                        {exit.distanceToSchool ? (
                          <Text className={styles.exitMeta}>距学校约 {exit.distanceToSchool} 公里 · 车程 8-12 分钟</Text>
                        ) : (
                          <Text className={styles.exitMeta}>在此集合出发前往地铁站</Text>
                        )}
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Step 2：GPS 验证 */}
      <View className={styles.card}>
        <View className={styles.stepTitle}>
          <View className={styles.stepNo}>2</View>
          <Text className={styles.stepName}>位置验证</Text>
          <Text className={styles.stepHint}>需在集合点 {GPS_RADIUS} 米内</Text>
        </View>

        <View
          className={classnames(
            styles.gpsBox,
            gps?.passed ? styles.gpsOk : !gps ? styles.gpsIdle : styles.gpsFail
          )}
        >
          {gps?.passed ? (
            <>
              <Text className={styles.gpsStatusText}>
                <Text className={styles.ok}>● 验证通过</Text>
                ，距{selected?.exit.name}约 {gps.distance} 米
                {gps.mocked ? '（预览环境模拟定位）' : ''}
              </Text>
              <Text className={styles.gpsCoord}>你的位置：纬度 {gps.latitude.toFixed(6)}，经度 {gps.longitude.toFixed(6)}</Text>
              <Text className={styles.gpsDesc}>你的位置已在允许拼车范围内，匹配成功后请在此等候同行同学。</Text>
            </>
          ) : gps && !gps.passed ? (
            <>
              <Text className={styles.gpsStatusText}>
                <Text className={styles.fail}>● 距离较远</Text>
                ，当前距集合点约 {gps.distance} 米
              </Text>
              <Text className={styles.gpsCoord}>你的位置：纬度 {gps.latitude.toFixed(6)}，经度 {gps.longitude.toFixed(6)}</Text>
              <Text className={styles.gpsCoord}>集合点：纬度 {selected?.exit.latitude.toFixed(6)}，经度 {selected?.exit.longitude.toFixed(6)}</Text>
              <Text className={styles.gpsDesc}>请走到集合点附近后重新验证；如定位有偏差，可尝试在开阔处再次获取定位。</Text>
            </>
          ) : (
            <>
              <Text className={styles.gpsStatusText}>
                <Text className={styles.idle}>○ 待验证</Text>
                {selected ? `：${selected.stationName} ${selected.exit.name}` : '（请先选择集合点）'}
              </Text>
              {selected && (
                <Text className={styles.gpsCoord}>集合点：纬度 {selected.exit.latitude.toFixed(6)}，经度 {selected.exit.longitude.toFixed(6)}</Text>
              )}
              <Text className={styles.gpsDesc}>系统将获取你的实时位置，与集合点坐标计算距离，防止远距离恶意下单。</Text>
            </>
          )}
        </View>

        <Button className={styles.gpsBtn} loading={gpsLoading} onClick={handleGpsVerify}>
          {gps?.passed ? '重新验证我的位置' : '验证我的位置'}
        </Button>

        {gps && selected && (
          <Map
            className={styles.gpsMap}
            longitude={gps.longitude}
            latitude={gps.latitude}
            scale={16}
            showLocation
            onError={(e) => console.error('[Publish] map load failed:', e.detail)}
            circles={[
              {
                latitude: selected.exit.latitude,
                longitude: selected.exit.longitude,
                radius: GPS_RADIUS,
                color: '#1e6fff66',
                fillColor: '#1e6fff15',
                strokeWidth: 2
              }
            ]}
          />
        )}
      </View>

      {/* Step 3：拼车信息 */}
      <View className={styles.card}>
        <View className={styles.stepTitle}>
          <View className={styles.stepNo}>3</View>
          <Text className={styles.stepName}>拼车信息</Text>
          <Text className={styles.stepHint}>匹配成功后才会向对方展示</Text>
        </View>

        <View className={styles.formItem}>
          <Text className={styles.formLabel}>打车参考报价（人均/元）</Text>
          <View className={styles.priceInputWrap}>
            <Input
              className={styles.priceInput}
              type="digit"
              placeholder="如：10"
              value={price}
              onInput={(e) => setPrice(e.detail.value)}
            />
            <Text className={styles.priceUnit}>元 / 人</Text>
          </View>
        </View>

        <View className={styles.formItem}>
          <Text className={styles.formLabel}>等候位置</Text>
          <Input
            className={styles.formInput}
            placeholder="如：出口旁 711 便利店门口"
            value={waitLocation}
            onInput={(e) => setWaitLocation(e.detail.value)}
            maxlength={40}
          />
        </View>

        <View className={styles.formItem}>
          <Text className={styles.formLabel}>服装 / 外貌描述</Text>
          <Input
            className={styles.formInput}
            placeholder="如：黑色外套、蓝色牛仔裤、背黑色书包"
            value={outfit}
            onInput={(e) => setOutfit(e.detail.value)}
            maxlength={50}
          />
        </View>

        <View className={styles.formItem}>
          <Text className={styles.formLabel}>现场照片（便于线下辨认，选填）</Text>
          <View className={styles.photoRow}>
            {photo ? (
              <View className={styles.photoBox}>
                <Image className={styles.photoImg} src={photo} mode="aspectFill" onClick={choosePhoto} />
              </View>
            ) : (
              <View className={styles.photoAdd} onClick={choosePhoto}>
                <Text className={styles.plus}>+</Text>
                <Text className={styles.addText}>上传照片</Text>
              </View>
            )}
            <Text className={styles.photoTip}>照片仅匹配成功后在临时聊天中展示，未匹配前不公开。</Text>
          </View>
        </View>

        <View className={styles.switchRow}>
          <View>
            <Text className={styles.switchLabel}>保存本次信息为默认内容</Text>
            <Text className={styles.switchHint}>下次发起拼车自动填充，减少重复输入</Text>
          </View>
          <Switch checked={saveAsDefault} color="#1e6fff" onChange={(e) => setSaveAsDefault(e.detail.value)} />
        </View>
      </View>

      {/* Step 4：人数 */}
      <View className={styles.card}>
        <View className={styles.stepTitle}>
          <View className={styles.stepNo}>4</View>
          <Text className={styles.stepName}>拼车人数</Text>
        </View>
        <View className={styles.sizeGrid}>
          <View
            className={classnames(styles.sizeCard, targetSize === 2 && styles.sizeCardActive)}
            onClick={() => setTargetSize(2)}
          >
            <Text className={styles.sizeNum}>2 人</Text>
            <Text className={styles.sizeDesc}>与 1 位同学同行</Text>
          </View>
          <View
            className={classnames(styles.sizeCard, targetSize === 3 && styles.sizeCardActive)}
            onClick={() => setTargetSize(3)}
          >
            <Text className={styles.sizeNum}>3 人</Text>
            <Text className={styles.sizeDesc}>与 2 位同学同行 · 人均更省</Text>
          </View>
        </View>
      </View>

      {/* 底部提交 */}
      <View className={styles.footer}>
        <Button
          className={classnames(styles.submitBtn, !canSubmit && styles.submitBtnDisabled)}
          loading={submitting}
          onClick={handleSubmit}
        >
          {cooldownMs > 0
            ? `匹配冷却中（${formatCountdown(cooldownMs)}）`
            : gps?.passed
              ? '立即拼车，进入匹配'
              : '完成以上步骤后发起拼车'}
        </Button>
      </View>
      </>
      )}
    </View>
  )
}
