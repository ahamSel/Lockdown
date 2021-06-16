using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class ClampPlayer : MonoBehaviour
{
    public AdjustWalls adjustWalls;
    SpriteRenderer playerSpriteR;

    void Start()
    {
        playerSpriteR = GetComponent<SpriteRenderer>();
    }

    void LateUpdate()
    {
        float halfPlayerWidth = playerSpriteR.bounds.extents.x;
        float halfPlayerHeight = playerSpriteR.bounds.extents.y;
        
        Vector3 playerPos = transform.position;
        // 0.25 = half wall width
        playerPos.x = Mathf.Clamp(playerPos.x, -adjustWalls.cameraWidth + halfPlayerWidth + 0.25f, adjustWalls.cameraWidth - halfPlayerWidth - 0.25f);
        playerPos.y = Mathf.Clamp(playerPos.y, -adjustWalls.cameraHeight + halfPlayerHeight + 0.25f, adjustWalls.cameraHeight - halfPlayerHeight - 0.25f);
        
        transform.position = playerPos;
    }
}